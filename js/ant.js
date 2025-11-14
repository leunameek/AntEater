/**
 * ANT CLASS - Organized by Functionality
 * 
 * This class represents an individual ant in the colony simulation.
 * Methods are organized into logical sections for better maintainability.
 */

class Ant {
    // ============================================================================
    // SECTION 1: CONSTRUCTOR & INITIALIZATION
    // ============================================================================
    
    constructor(scene, x, y, colony, role) {
        this.scene = scene;
        this.colony = colony;
        this.role = role || 'worker';
        this.id = colony.totalAntsBorn + 1; // Unique ID

        // Create ant sprite using the sprite sheet
        this.sprite = scene.add.sprite(x, y, 'ant_sprites', 'H00.png');
        this.sprite.setScale(0.3); // Adjusted scale for 128x128 sprites
        scene.physics.add.existing(this.sprite);

        // Create ID text above the ant
        this.idText = scene.add.text(x, y - 15, this.id.toString(), {
            fontFamily: 'Jersey 10',
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.idText.setOrigin(0.5, 0.5);
        this.idText.setDepth(5); // Above the ant sprite

        // Physics properties
        this.sprite.body.setCollideWorldBounds(true);
        this.sprite.body.setBounce(0.1);
        this.sprite.body.setDrag(50);

        // Ant properties
        this.speed = 80 + Math.random() * 40; // Random speed variation
        this.energy = 100;
        this.maxEnergy = 100;
        this.carryingFood = false;
        this.foodAmount = 0;
        this.maxFoodCarry = 10;

        // Statistics
        this.foodCollected = 0;
        this.fedBrood = false;
        this.lifespan = 0;
        this.corpsesCollected = 0;

        // Puddle damage tracking
        this.inPuddle = false;
        this.puddleTime = 0;
        this.puddleDamageApplied = false;
        
        // Behavior properties
        this.state = 'exploring'; // exploring, seeking_food, returning_home, following_trail, resting, feeding_brood, collecting_corpse
        this.target = null;
        this.lastPheromoneDrop = 0;
        this.pheromoneDropInterval = 100; // milliseconds
        this.explorationRadius = 200;
        this.homePosition = { x: x, y: y };

        // Resting properties
        this.resting = false;
        this.restTimer = 0;
        this.restDuration = 0;

        // Make ant clickable
        this.sprite.setInteractive();
        this.sprite.on('pointerdown', () => {
            if (this.scene.selectAnt) {
                this.scene.selectAnt(this);
            }
        });
        
        // Movement properties
        this.direction = Math.random() * Math.PI * 2;
        this.wanderAngle = 0;
        this.wanderRadius = 25;
        this.wanderDistance = 50;
        this.wanderJitter = 0.3;
        
        // Trail following
        this.trailMemory = [];
        this.maxTrailMemory = 20;

        // Movement trail for following
        this.movementTrail = [];
        this.maxMovementTrail = 1000; // Increased from 50 to 1000 for much longer trails
        this.trailGraphics = null;
        this.isBeingFollowed = false;
        this.persistentTrail = []; // Store complete trail history
        this.maxPersistentTrail = 2000; // Maximum persistent trail length

        // Animation properties
        this.currentFrame = 0;
        this.animationSpeed = 10; // frames per second
        this.lastFrameChange = 0;
        
        // Set initial velocity
        this.updateMovement();
    }
    
    createWalkingAnimation(scene) {
        // Create walking animation frames
        const frameNames = [];
        for (let i = 0; i < 8; i++) {
            frameNames.push({ key: 'ant_sprites', frame: `H${i.toString().padStart(2, '0')}.png` });
        }
        
        // Create the animation
        scene.anims.create({
            key: 'ant_walking',
            frames: frameNames,
            frameRate: 10,
            repeat: -1
        });
        
        // Start with first frame
        this.sprite.setTexture('ant_sprites', 'H00.png');
    }

    // ============================================================================
    // SECTION 2: CORE UPDATE LOOP
    // ============================================================================

    update(time, delta) {
        this.energy -= 0.1 * delta / 1000; // Energy decreases over time
        this.lifespan += delta / 1000; // Track lifespan

        // Handle puddle damage
        this.handlePuddleDamage(delta);

        if (this.energy <= 0) {
            this.die();
            return;
        }

        // Handle resting state
        if (this.resting) {
            this.restTimer -= delta;
            if (this.restTimer <= 0) {
                this.resting = false;
                this.sprite.setVisible(true);
                if (this.idText) {
                    this.idText.setVisible(true);
                }
                this.state = 'exploring';
            }
            return; // Don't execute other behaviors while resting
        }

        // Update state based on current situation
        this.updateState();

        // Execute behavior based on state
        switch (this.state) {
            case 'exploring':
                this.explore();
                break;
            case 'seeking_food':
                this.seekFood();
                break;
            case 'returning_home':
                this.returnHome();
                break;
            case 'following_trail':
                this.followTrail();
                break;
            case 'attacking_termite':
                this.attackTermite();
                break;
            case 'hiding':
                this.hide();
                break;
            case 'feeding_brood':
                this.feedBrood();
                break;
            case 'collecting_corpse':
                this.collectCorpse();
                break;
            case 'avoiding_danger':
                this.avoidDangerBehavior();
                break;
        }

        // Drop pheromones
        this.dropPheromones(time);

        // Update movement
        this.updateMovement();

        // Update visual appearance
        this.updateVisuals();

        // Update sprite rotation to face movement direction
        this.sprite.setRotation(this.direction + Math.PI / 2);

        // Update animation
        this.updateAnimation(time);

        // Update movement trail
        this.updateMovementTrail();

        // Update ID text position to follow the ant
        if (this.idText) {
            this.idText.setPosition(this.sprite.x, this.sprite.y - 15);
        }
    }
    
    updateState() {
        // During attack, soldiers defend, others hide
        if (this.scene.attackActive) {
            if (this.role === 'soldier') {
                // Soldiers seek and attack termites
                const nearestTermite = this.findNearestTermite();
                if (nearestTermite && this.getDistance(nearestTermite.sprite.x, nearestTermite.sprite.y) < 150) {
                    this.state = 'attacking_termite';
                    this.target = nearestTermite;
                    return;
                }
            } else {
                // Other ants hide near colony
                this.state = 'hiding';
                return;
            }
        }

        // If attack ended while hiding, start exploring
        if (this.state === 'hiding' && !this.scene.attackActive) {
            this.state = 'exploring';
            this.target = null;
        }

        // Nurse ants prioritize feeding brood
        if (this.role === 'nurse' && !this.carryingFood && this.state !== 'feeding_brood') {
            this.state = 'feeding_brood';
            return;
        }

        // Check for nearby corpses to collect
        if (!this.carryingFood && this.state !== 'collecting_corpse') {
            const nearestCorpse = this.findNearestCorpse();
            if (nearestCorpse && this.getDistance(nearestCorpse.x, nearestCorpse.y) < 100) {
                this.state = 'collecting_corpse';
                this.target = nearestCorpse;
                return;
            }
        }

        // Check for danger pheromones (avoid puddles) - highest priority
        const dangerPheromone = this.findNearbyDangerPheromone();
        if (dangerPheromone && !this.carryingFood) {
            // Avoid areas with danger pheromones
            this.avoidDanger(dangerPheromone);
            return;
        }

        if (this.carryingFood) {
            this.state = 'returning_home';
        } else if (this.target && this.target.active && !this.target.isDepleted()) {
            this.state = 'seeking_food';
        } else {
            // Check for nearby pheromone trails
            const nearbyTrail = this.findNearbyPheromoneTrail();
            if (nearbyTrail && !this.carryingFood) {
                this.state = 'following_trail';
                this.target = nearbyTrail;
            } else {
                // Look for food sources if no trails found
                const nearestFood = this.scene.foodManager.getNearestFoodSource(
                    this.sprite.x,
                    this.sprite.y,
                    300 // Increased from 200 to 300 for better food detection
                );
                if (nearestFood && nearestFood.active && !nearestFood.isDepleted()) {
                    this.setTarget(nearestFood);
                    this.state = 'seeking_food';
                } else {
                    this.state = 'exploring';
                }
            }
        }
    }

    updateAnimation(time) {
        // Simple frame cycling for walking animation
        if (time - this.lastFrameChange > (1000 / this.animationSpeed)) {
            this.currentFrame = (this.currentFrame + 1) % 8;
            const frameName = `H${this.currentFrame.toString().padStart(2, '0')}.png`;
            this.sprite.setTexture('ant_sprites', frameName);
            this.lastFrameChange = time;
        }
    }

    // ============================================================================
    // SECTION 3: BEHAVIOR STATES
    // ============================================================================
    
    explore() {
        // Wander behavior with some randomness
        this.wanderAngle += (Math.random() - 0.5) * this.wanderJitter;
        
        const targetX = this.sprite.x + Math.cos(this.wanderAngle) * this.wanderDistance;
        const targetY = this.sprite.y + Math.sin(this.wanderAngle) * this.wanderDistance;
        
        // Add some randomness to prevent getting stuck
        const randomFactor = 0.1;
        this.direction = Math.atan2(
            targetY - this.sprite.y + (Math.random() - 0.5) * randomFactor,
            targetX - this.sprite.x + (Math.random() - 0.5) * randomFactor
        );
    }
    
    seekFood() {
        if (this.target && this.target.active && !this.target.isDepleted()) {
            const dx = this.target.x - this.sprite.x;
            const dy = this.target.y - this.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 20) {
                // Reached food source
                this.collectFood(this.target);
            } else {
                this.direction = Math.atan2(dy, dx);
            }
        } else {
            this.target = null;
            this.state = 'exploring';
        }
    }
    
    returnHome() {
        const dx = this.homePosition.x - this.sprite.x;
        const dy = this.homePosition.y - this.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 30) {
            // Reached home
            this.depositFood();
        } else {
            this.direction = Math.atan2(dy, dx);
        }
    }
    
    followTrail() {
        if (this.target && this.target.active && !this.target.isDepleted()) {
            const dx = this.target.x - this.sprite.x;
            const dy = this.target.y - this.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Enhanced trail following with wider acceptance radius and trail prediction
            const acceptanceRadius = 25; // Increased from 15 to 25 pixels
            
            if (distance < acceptanceRadius) {
                // Reached trail point, look for next one
                this.target = this.findNextTrailPoint();
                if (!this.target) {
                    // No more trail points, check if there's food nearby to collect
                    const nearestFood = this.scene.foodManager.getNearestFoodSource(
                        this.sprite.x,
                        this.sprite.y,
                        250 // Increased from 150 to 250 for better food detection at trail end
                    );
                    if (nearestFood && nearestFood.active && !nearestFood.isDepleted()) {
                        this.setTarget(nearestFood);
                        this.state = 'seeking_food';
                    } else {
                        this.state = 'exploring';
                    }
                }
            } else {
                // Enhanced directional following - look ahead for better trail following
                this.enhancedTrailFollowing(dx, dy, distance);
            }
        } else {
            // Decrement trail length when stopping following
            if (this.target && this.target.trailLength > 0) {
                this.target.trailLength--;
            }
            this.state = 'exploring';
        }
    }

    enhancedTrailFollowing(dx, dy, distance) {
        // Look for additional pheromones ahead to predict trail direction
        const lookAheadDistance = 80; // Look 80 pixels ahead
        const lookAheadX = this.sprite.x + (dx / distance) * lookAheadDistance;
        const lookAheadY = this.sprite.y + (dy / distance) * lookAheadDistance;
        
        const aheadPheromone = this.scene.pheromoneSystem.findStrongestPheromone(
            lookAheadX,
            lookAheadY,
            40, // Search radius for ahead pheromones
            'food_trail'
        );
        
        if (aheadPheromone) {
            // There are pheromones ahead - follow the main direction
            this.direction = Math.atan2(dy, dx);
        } else {
            // No pheromones ahead - might be at the end of trail, be more cautious
            this.direction = Math.atan2(dy, dx);
            
            // If we're very far from the trail point, try to find a closer one
            if (distance > 100) {
                const closerTrail = this.findNextTrailPoint();
                if (closerTrail) {
                    this.target = closerTrail;
                }
            }
        }
    }

    attackTermite() {
        if (this.target && this.target.isAlive()) {
            const dx = this.target.sprite.x - this.sprite.x;
            const dy = this.target.sprite.y - this.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 20) {
                // Attack termite
                this.target.takeDamage(15); // Soldier damage
                this.energy = Math.max(0, this.energy - 5); // Cost to attack
                if (this.energy <= 0) {
                    this.die();
                }
            } else {
                this.direction = Math.atan2(dy, dx);
            }
        } else {
            this.state = 'exploring';
            this.target = null;
        }
    }

    hide() {
        // Move towards colony center to hide
        const colonyX = this.scene.cameras.main.width / 2;
        const colonyY = this.scene.cameras.main.height / 2;
        const dx = colonyX - this.sprite.x;
        const dy = colonyY - this.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 50) {
            this.direction = Math.atan2(dy, dx);
        } else {
            // Stop moving when close to colony
            this.sprite.body.setVelocity(0, 0);
        }
    }

    feedBrood() {
        // Nurse ants always feed brood, others may do it occasionally
        if (this.role === 'nurse' || Math.random() < 0.3) {
            // Simulate feeding brood
            this.fedBrood = true;
            this.energy = Math.max(0, this.energy - 5); // Cost energy to feed brood

            // After feeding, start resting
            this.startResting();
        } else {
            // Not feeding brood this time, go back to exploring
            this.state = 'exploring';
        }
    }

    collectCorpse() {
        if (this.target && !this.target.collected) {
            const dx = this.target.x - this.sprite.x;
            const dy = this.target.y - this.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 15) {
                // Collect the corpse
                this.target.collected = true;
                this.target.sprite.destroy();
                this.corpsesCollected++;

                // Remove from corpses array
                const index = this.scene.corpses.indexOf(this.target);
                if (index !== -1) {
                    this.scene.corpses.splice(index, 1);
                }

                // Return to colony to "hide" the corpse
                this.state = 'returning_home';
                this.target = null;
            } else {
                this.direction = Math.atan2(dy, dx);
            }
        } else {
            this.state = 'exploring';
            this.target = null;
        }
    }

    avoidDangerBehavior() {
        // Continue moving away from danger for a longer time to ensure learning
        // After avoiding danger, check if we're still in danger
        const dangerPheromone = this.findNearbyDangerPheromone();
        if (!dangerPheromone) {
            // No more danger detected, return to normal behavior
            this.speed = 80 + Math.random() * 40; // Reset speed
            this.state = 'exploring';
            this.target = null;
        } else {
            // Still in danger, continue avoiding with increased urgency
            this.avoidDanger(dangerPheromone);
            // Stay in avoiding_danger state longer
        }
    }

    // ============================================================================
    // SECTION 4: FOOD MANAGEMENT
    // ============================================================================
    
    collectFood(foodSource) {
        if (foodSource && foodSource.active && foodSource.amount > 0) {
            const collected = Math.min(this.maxFoodCarry - this.foodAmount, foodSource.amount);
            this.foodAmount += collected;
            foodSource.amount -= collected;

            // Set carrying food if we have any food or if source is depleted
            if (this.foodAmount > 0 && (this.foodAmount >= this.maxFoodCarry || foodSource.isDepleted())) {
                this.carryingFood = true;
                this.target = null;
            }

            // Update food source visual
            foodSource.updateVisual();

            // If food source is depleted after collection, clear target
            if (foodSource.isDepleted()) {
                this.target = null;
            }
        }
    }
    
    depositFood() {
        if (this.carryingFood) {
            this.colony.addFood(this.foodAmount);
            this.foodCollected += this.foodAmount;
            this.foodAmount = 0;
            this.carryingFood = false;
            this.energy = Math.min(this.maxEnergy, this.energy + 20); // Restore some energy

            // Start resting after depositing food
            this.startResting();
        }
    }

    startResting() {
        // Determine rest duration based on tasks performed
        const hasFedBrood = this.fedBrood;
        this.fedBrood = false; // Reset for next cycle

        if (hasFedBrood) {
            // Did both tasks: store food and feed brood
            this.restDuration = 4000 + Math.random() * 3000; // 4-7 seconds
        } else {
            // Did only one task: store food
            this.restDuration = 3000 + Math.random() * 2000; // 3-5 seconds
        }

        this.resting = true;
        this.restTimer = this.restDuration;
        this.sprite.setVisible(false);
        if (this.idText) {
            this.idText.setVisible(false);
        }
        this.state = 'resting';
    }

    // ============================================================================
    // SECTION 5: PHEROMONE SYSTEM
    // ============================================================================
    
    dropPheromones(time) {
        if (time - this.lastPheromoneDrop > this.pheromoneDropInterval) {
            if (this.carryingFood) {
                // Drop strong pheromones when carrying food
                this.scene.pheromoneSystem.addPheromone(
                    this.sprite.x, 
                    this.sprite.y, 
                    'food_trail', 
                    1.0
                );
            } else if (this.state === 'exploring') {
                // Drop weak exploration pheromones
                this.scene.pheromoneSystem.addPheromone(
                    this.sprite.x, 
                    this.sprite.y, 
                    'exploration', 
                    0.3
                );
            }
            this.lastPheromoneDrop = time;
        }
    }
    
    findNearbyPheromoneTrail() {
        const trail = this.scene.pheromoneSystem.findStrongestPheromone(
            this.sprite.x,
            this.sprite.y,
            180, // Increased from 100 to 180 for much better trail detection
            'food_trail'
        );

        // Increment trail length when an ant starts following
        if (trail) {
            trail.trailLength = (trail.trailLength || 0) + 1;
        }

        return trail;
    }
    
    findNextTrailPoint() {
        const trail = this.scene.pheromoneSystem.findStrongestPheromone(
            this.sprite.x,
            this.sprite.y,
            120, // Increased from 60 to 120 for much better trail continuity
            'food_trail'
        );

        return trail;
    }

    findNearbyDangerPheromone() {
        // Look for danger pheromones in a wider radius than food pheromones
        // Increase detection range to ensure ants learn from deaths
        return this.scene.pheromoneSystem.findStrongestPheromone(
            this.sprite.x,
            this.sprite.y,
            80, // Increased from 60 to 80 for better learning
            'danger'
        );
    }

    // ============================================================================
    // SECTION 6: DANGER AVOIDANCE & PATHFINDING
    // ============================================================================

    avoidDanger(dangerPheromone) {
        if (!dangerPheromone) return;

        // Move away from the danger pheromone
        const dx = this.sprite.x - dangerPheromone.x;
        const dy = this.sprite.y - dangerPheromone.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            // Set direction away from danger with some randomness to avoid clustering
            const randomAngle = (Math.random() - 0.5) * Math.PI * 0.5; // ±45 degrees randomness
            this.direction = Math.atan2(dy, dx) + randomAngle;

            // Move faster when avoiding danger
            this.speed = Math.min(this.speed * 1.8, 140); // Increased speed boost

            // Clear any current target
            this.target = null;
            this.state = 'avoiding_danger';
        }
    }

    // ============================================================================
    // SECTION 7: COMBAT & THREAT DETECTION
    // ============================================================================

    findNearestTermite() {
        let nearest = null;
        let minDistance = Infinity;

        for (const termite of this.scene.termites) {
            if (!termite.isAlive()) continue;
            const distance = this.getDistance(termite.sprite.x, termite.sprite.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = termite;
            }
        }

        return nearest;
    }

    findNearestCorpse() {
        let nearest = null;
        let minDistance = Infinity;

        for (const corpse of this.scene.corpses) {
            if (corpse.collected) continue;
            const distance = this.getDistance(corpse.x, corpse.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = corpse;
            }
        }

        return nearest;
    }

    handlePuddleDamage(delta) {
        // Check if ant is currently in a puddle
        // Only check if puddle system exists (puddles enabled)
        if (!this.scene.puddleSystem) {
            // Reset puddle state if puddles are disabled
            this.inPuddle = false;
            this.puddleTime = 0;
            this.puddleDamageApplied = false;
            return;
        }

        const inPuddleNow = this.scene.puddleSystem.checkAntInPuddle(this);

        if (inPuddleNow) {
            if (!this.inPuddle) {
                // Just entered puddle
                this.inPuddle = true;
                this.puddleTime = 0;
                this.puddleDamageApplied = false;
            } else {
                // Still in puddle, accumulate time
                this.puddleTime += delta / 1000; // Convert to seconds

                // Apply 50% health decay at 2 seconds
                if (this.puddleTime >= 2 && !this.puddleDamageApplied) {
                    this.energy *= 0.5; // Reduce to 50%
                    this.puddleDamageApplied = true;
                }

                // Die at 3.5 seconds
                if (this.puddleTime >= 3.5) {
                    this.die();
                    return;
                }
            }
        } else {
            if (this.inPuddle) {
                // Just left puddle
                this.inPuddle = false;
                this.puddleTime = 0;
                this.puddleDamageApplied = false;
            }
        }
    }

    // ============================================================================
    // SECTION 8: MOVEMENT & VISUALS
    // ============================================================================
    
    updateMovement() {
        // Apply movement with some randomness
        const speedVariation = 0.8 + Math.random() * 0.4;
        let currentSpeed = this.speed * speedVariation;

        // Apply terrain speed modifier
        if (this.scene.terrainSystem) {
            const terrain = this.scene.terrainSystem.getTerrainAt(this.sprite.x, this.sprite.y);
            if (terrain) {
                const terrainModifier = this.scene.terrainSystem.getSpeedModifier(terrain.type, this.scene.rainActive);
                currentSpeed *= terrainModifier;
            }
        }

        this.sprite.body.setVelocity(
            Math.cos(this.direction) * currentSpeed,
            Math.sin(this.direction) * currentSpeed
        );
    }
    
    updateVisuals() {
        // Change tint based on state (since we're using a sprite now, not a circle)
        if (this.scene.attackActive && this.role === 'soldier') {
            this.sprite.setTint(0xDC143C); // Crimson red for soldiers during attack
        } else if (this.carryingFood) {
            this.sprite.setTint(0x00FF00); // Bright green when carrying food
        } else if (this.state === 'seeking_food') {
            this.sprite.setTint(0xFF8C00); // Bright orange when seeking food
        } else if (this.state === 'returning_home') {
            this.sprite.setTint(0x4169E1); // Royal blue when returning home
        } else if (this.state === 'hiding') {
            this.sprite.setTint(0x808080); // Gray when hiding
        } else if (this.state === 'avoiding_danger') {
            this.sprite.setTint(0xFF0000); // Red when avoiding danger
        } else {
            this.sprite.clearTint(); // Default color when exploring
        }

        // Add a small trail effect
        this.addTrailEffect();
    }
    
    addTrailEffect() {
        // Create a subtle trail effect
        const trail = this.scene.add.circle(
            this.sprite.x,
            this.sprite.y,
            2,
            0xFFFFFF,
            0.5
        );

        this.scene.tweens.add({
            targets: trail,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            duration: 500,
            onComplete: () => trail.destroy()
        });
    }

    // ============================================================================
    // SECTION 9: TRAIL FOLLOWING VISUALS
    // ============================================================================

    updateMovementTrail() {
        // Add current position to trail
        this.movementTrail.push({
            x: this.sprite.x,
            y: this.sprite.y,
            timestamp: Date.now()
        });

        // Add to persistent trail (complete history)
        this.persistentTrail.push({
            x: this.sprite.x,
            y: this.sprite.y,
            timestamp: Date.now(),
            state: this.state, // Track what the ant was doing at this position
            carryingFood: this.carryingFood // Track food carrying status
        });

        // Keep only recent positions for movement buffer
        if (this.movementTrail.length > this.maxMovementTrail) {
            this.movementTrail.shift();
        }

        // Limit persistent trail size but keep it much longer
        if (this.persistentTrail.length > this.maxPersistentTrail) {
            // Remove older points but keep more history than before
            this.persistentTrail.splice(0, 500); // Remove oldest 500 points but keep rest
        }

        // Update trail graphics if being followed
        if (this.isBeingFollowed) {
            this.updateTrailGraphics();
        }
    }

    updateTrailGraphics() {
        // Clear existing graphics
        if (this.trailGraphics) {
            this.trailGraphics.clear();
        } else {
            this.trailGraphics = this.scene.add.graphics();
            this.trailGraphics.setDepth(1); // Above terrain, below ants
        }

        // Draw persistent trail with different colors for different states
        if (this.persistentTrail.length > 1) {
            // Draw trail segments with state-based colors
            for (let i = 1; i < this.persistentTrail.length; i++) {
                const current = this.persistentTrail[i];
                const previous = this.persistentTrail[i - 1];
                
                // Choose color based on the ant's state during this segment
                let color = 0xFFFF00; // Default yellow for exploring
                let alpha = 0.6;
                let lineWidth = 2;
                
                if (current.carryingFood) {
                    color = 0x00FF00; // Bright green when carrying food
                    alpha = 0.9;
                    lineWidth = 4;
                } else if (current.state === 'seeking_food') {
                    color = 0xFF8C00; // Orange for seeking food
                    alpha = 0.7;
                    lineWidth = 3;
                } else if (current.state === 'returning_home') {
                    color = 0x4169E1; // Blue for returning home
                    alpha = 0.8;
                    lineWidth = 3;
                } else if (current.state === 'following_trail') {
                    color = 0x9932CC; // Purple for following trails
                    alpha = 0.7;
                    lineWidth = 3;
                } else if (current.state === 'avoiding_danger') {
                    color = 0xFF0000; // Red for avoiding danger
                    alpha = 0.8;
                    lineWidth = 3;
                }
                
                // Fade older segments
                const ageFactor = Math.max(0.2, 1 - (i / this.persistentTrail.length));
                alpha *= ageFactor;
                
                // Draw segment
                this.trailGraphics.lineStyle(lineWidth, color, alpha);
                this.trailGraphics.beginPath();
                this.trailGraphics.moveTo(previous.x, previous.y);
                this.trailGraphics.lineTo(current.x, current.y);
                this.trailGraphics.strokePath();
            }
        }

        // Draw current position marker
        if (this.persistentTrail.length > 0) {
            const currentPos = this.persistentTrail[this.persistentTrail.length - 1];
            this.trailGraphics.fillStyle(0xFFFFFF, 1.0);
            this.trailGraphics.fillCircle(currentPos.x, currentPos.y, 4);
            this.trailGraphics.lineStyle(2, 0x000000, 1.0);
            this.trailGraphics.strokeCircle(currentPos.x, currentPos.y, 4);
        }
    }

    startFollowing() {
        this.isBeingFollowed = true;
        this.updateTrailGraphics();
        console.log(`Started following ant ${this.id} - showing complete trail of ${this.persistentTrail.length} positions`);
    }

    stopFollowing() {
        this.isBeingFollowed = false;
        if (this.trailGraphics) {
            this.trailGraphics.clear();
        }
        console.log(`Stopped following ant ${this.id}`);
    }

    toggleFollowing() {
        if (this.isBeingFollowed) {
            this.stopFollowing();
        } else {
            this.startFollowing();
        }
    }

    // Enhanced following start that integrates with camera system
    startFollowing() {
        this.isBeingFollowed = true;
        this.updateTrailGraphics();
        console.log(`Started following ant ${this.id} - showing complete trail of ${this.persistentTrail.length} positions`);
    }

    // Enhanced following stop that integrates with camera system
    stopFollowing() {
        this.isBeingFollowed = false;
        if (this.trailGraphics) {
            this.trailGraphics.clear();
        }
        console.log(`Stopped following ant ${this.id}`);
    }

    // Method to show trail info
    getTrailInfo() {
        return {
            totalPositions: this.persistentTrail.length,
            currentState: this.state,
            trailLength: this.calculateTrailLength(),
            timeSpan: this.persistentTrail.length > 0 ?
                (this.persistentTrail[this.persistentTrail.length - 1].timestamp - this.persistentTrail[0].timestamp) / 1000 : 0
        };
    }

    calculateTrailLength() {
        if (this.persistentTrail.length < 2) return 0;
        
        let totalLength = 0;
        for (let i = 1; i < this.persistentTrail.length; i++) {
            const dx = this.persistentTrail[i].x - this.persistentTrail[i - 1].x;
            const dy = this.persistentTrail[i].y - this.persistentTrail[i - 1].y;
            totalLength += Math.sqrt(dx * dx + dy * dy);
        }
        return Math.round(totalLength);
    }

    // ============================================================================
    // SECTION 10: UTILITY METHODS
    // ============================================================================

    getDistance(x, y) {
        const dx = x - this.sprite.x;
        const dy = y - this.sprite.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    setTarget(target) {
        this.target = target;
    }
    
    getPosition() {
        return { x: this.sprite.x, y: this.sprite.y };
    }
    
    isAlive() {
        return this.sprite && this.sprite.active && this.energy > 0;
    }

    getStats() {
        const healthPercent = Math.floor((this.energy / this.maxEnergy) * 100);
        let status = 'Healthy';
        if (this.colony.foodStorage < 20) {
            status = 'Sick';
        } else if (this.colony.foodStorage < 50) {
            status = 'Needs Food';
        } else if (this.colony.foodStorage < 100) {
            status = 'Weak';
        }

        return {
            id: this.id,
            role: this.role,
            health: healthPercent + '%',
            status: status,
            energy: Math.floor(this.energy),
            foodCollected: this.foodCollected,
            fedBrood: this.fedBrood ? 'Yes' : 'No',
            lifespan: Math.floor(this.lifespan) + 's',
            corpsesCollected: this.corpsesCollected
        };
    }

    // ============================================================================
    // SECTION 11: LIFECYCLE
    // ============================================================================
    
    die() {
        // Remove from colony
        this.colony.removeAnt(this);

        // Create corpse
        const corpse = {
            x: this.sprite.x,
            y: this.sprite.y,
            sprite: this.scene.add.circle(this.sprite.x, this.sprite.y, 12, 0x654321),
            collected: false
        };
        this.scene.corpses.push(corpse);

        // Create death effect
        const deathEffect = this.scene.add.circle(
            this.sprite.x,
            this.sprite.y,
            10,
            0x8B0000,
            0.7
        );

        this.scene.tweens.add({
            targets: deathEffect,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 1000,
            onComplete: () => deathEffect.destroy()
        });

        // Stop following if being followed
        if (this.isBeingFollowed) {
            this.stopFollowing();
        }

        // Destroy ant sprite and ID text
        this.sprite.destroy();
        if (this.idText) {
            this.idText.destroy();
        }
    }
}
