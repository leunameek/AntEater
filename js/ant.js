class Ant {
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
        this.pheromoneDropInterval = 50; // Drop pheromones more frequently (every 50ms)
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
        this.maxMovementTrail = 50; // Store last 50 positions
        this.trailGraphics = null;
        this.isBeingFollowed = false;

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

    updateAnimation(time) {
        // Simple frame cycling for walking animation
        if (time - this.lastFrameChange > (1000 / this.animationSpeed)) {
            this.currentFrame = (this.currentFrame + 1) % 8;
            const frameName = `H${this.currentFrame.toString().padStart(2, '0')}.png`;
            this.sprite.setTexture('ant_sprites', frameName);
            this.lastFrameChange = time;
        }
    }
    
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
        } else {
            // Check for nearby food trails FIRST (higher priority than direct food search)
            // Boost detection range if we're already following a trail
            const trailDetectionRadius = this.state === 'following_trail' ? 150 : 120;
            const nearbyTrail = this.findNearbyPheromoneTrailWithRadius(trailDetectionRadius);
            if (nearbyTrail && !this.carryingFood) {
                this.state = 'following_trail';
                this.target = nearbyTrail;
                return;
            }
            
            // Then check for direct food sources
            if (this.target && this.target.active && !this.target.isDepleted()) {
                this.state = 'seeking_food';
                return;
            }
            
            // Look for new food sources if no trails or targets found
            const nearestFood = this.scene.foodManager.getNearestFoodSource(
                this.sprite.x,
                this.sprite.y,
                200 // Search radius for food
            );
            if (nearestFood && nearestFood.active && !nearestFood.isDepleted()) {
                this.setTarget(nearestFood);
                this.state = 'seeking_food';
            } else {
                this.state = 'exploring';
            }
        }
    }

    findNearbyPheromoneTrailWithRadius(radius) {
        // Enhanced version that accepts a custom detection radius
        const nearbyPheromones = this.scene.pheromoneSystem.findPheromonesInRadius(
            this.sprite.x,
            this.sprite.y,
            radius,
            'food_trail'
        );

        if (nearbyPheromones.length === 0) {
            return null;
        }

        // Filter out trails that lead to depleted food
        const validTrails = nearbyPheromones.filter(({ pheromone }) => {
            const foodSource = this.scene.foodManager.getNearestFoodSource(pheromone.x, pheromone.y, 40);
            return foodSource && !foodSource.isDepleted();
        });

        if (validTrails.length === 0) {
            return null;
        }

        // Sort by weighted intensity (closer + stronger = better target)
        validTrails.sort((a, b) => {
            const aWeight = a.pheromone.intensity * (1 - a.distance / radius);
            const bWeight = b.pheromone.intensity * (1 - b.distance / radius);
            return bWeight - aWeight;
        });

        // Increment trail length when an ant starts following
        if (validTrails[0].pheromone) {
            validTrails[0].pheromone.trailLength = (validTrails[0].pheromone.trailLength || 0) + 1;
        }

        return validTrails[0].pheromone;
    }
    
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
                // Check for puddles in the path to food
                const alternativeDirection = this.findSafeRouteToFood(dx, dy);
                if (alternativeDirection) {
                    this.direction = alternativeDirection;
                } else {
                    this.direction = Math.atan2(dy, dx);
                }
            }
        } else {
            this.target = null;
            this.state = 'exploring';
        }
    }

    findSafeRouteToFood(dx, dy) {
        // Similar to findSafeRouteToHome but for food sources
        const targetDistance = Math.sqrt(dx * dx + dy * dy);
        const stepSize = 25; // Check every 25 pixels along the path
        const steps = Math.floor(targetDistance / stepSize);
        
        const puddlesInPath = [];
        const currentX = this.sprite.x;
        const currentY = this.sprite.y;
        
        for (let i = 1; i <= steps; i++) {
            const t = (i * stepSize) / targetDistance;
            const pathX = currentX + dx * t;
            const pathY = currentY + dy * t;
            
            const puddle = this.scene.puddleSystem.getPuddleAt(pathX, pathY);
            if (puddle) {
                puddlesInPath.push({
                    puddle: puddle,
                    distance: stepSize * i,
                    centerX: pathX,
                    centerY: pathY
                });
            }
        }
        
        if (puddlesInPath.length === 0) {
            return null;
        }
        
        return this.calculateAlternativeRoute(puddlesInPath, dx, dy, targetDistance);
    }
    
    returnHome() {
        const dx = this.homePosition.x - this.sprite.x;
        const dy = this.homePosition.y - this.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 30) {
            // Reached home
            this.depositFood();
        } else {
            // Check for puddles in the direct path
            const alternativeDirection = this.findSafeRouteToHome(dx, dy);
            if (alternativeDirection) {
                this.direction = alternativeDirection;
            } else {
                this.direction = Math.atan2(dy, dx);
            }
        }
    }

    findSafeRouteToHome(dx, dy) {
        // Check if there are puddles in the direct path to home
        const targetDistance = Math.sqrt(dx * dx + dy * dy);
        const stepSize = 30; // Check every 30 pixels along the path
        const steps = Math.floor(targetDistance / stepSize);
        
        // Sample points along the path to detect puddles
        const puddlesInPath = [];
        const currentX = this.sprite.x;
        const currentY = this.sprite.y;
        
        for (let i = 1; i <= steps; i++) {
            const t = (i * stepSize) / targetDistance;
            const pathX = currentX + dx * t;
            const pathY = currentY + dy * t;
            
            // Check if this point is in a puddle
            const puddle = this.scene.puddleSystem.getPuddleAt(pathX, pathY);
            if (puddle) {
                puddlesInPath.push({
                    puddle: puddle,
                    distance: stepSize * i,
                    centerX: pathX,
                    centerY: pathY
                });
            }
        }
        
        // If no puddles in path, return direct route
        if (puddlesInPath.length === 0) {
            return null;
        }
        
        // Find the best alternative route
        return this.calculateAlternativeRoute(puddlesInPath, dx, dy, targetDistance);
    }

    calculateAlternativeRoute(puddlesInPath, dx, dy, targetDistance) {
        // Get the closest puddle blocking the path
        const closestPuddle = puddlesInPath[0];
        const puddleX = closestPuddle.puddle.x;
        const puddleY = closestPuddle.puddle.y;
        
        // Calculate the angle to the puddle center
        const puddleAngle = Math.atan2(puddleY - this.sprite.y, puddleX - this.sprite.x);
        
        // Calculate angles to go around the puddle (left or right)
        const puddleRadius = closestPuddle.puddle.radius;
        const safeDistance = puddleRadius + 20; // Extra margin for safety
        
        // Calculate direction vectors for left and right routes
        const directAngle = Math.atan2(dy, dx);
        const leftAngle = directAngle + Math.PI / 2;
        const rightAngle = directAngle - Math.PI / 2;
        
        // Calculate alternative target points
        const leftOffsetX = Math.cos(leftAngle) * safeDistance;
        const leftOffsetY = Math.sin(leftAngle) * safeDistance;
        const rightOffsetX = Math.cos(rightAngle) * safeDistance;
        const rightOffsetY = Math.sin(rightAngle) * safeDistance;
        
        // Calculate routes around puddle
        const leftRoute = {
            x: puddleX + leftOffsetX,
            y: puddleY + leftOffsetY,
            distance: Math.sqrt(
                (puddleX + leftOffsetX - this.homePosition.x) ** 2 + 
                (puddleY + leftOffsetY - this.homePosition.y) ** 2
            )
        };
        
        const rightRoute = {
            x: puddleX + rightOffsetX,
            y: puddleY + rightOffsetY,
            distance: Math.sqrt(
                (puddleX + rightOffsetX - this.homePosition.x) ** 2 + 
                (puddleY + rightOffsetY - this.homePosition.y) ** 2
            )
        };
        
        // Choose the shorter route
        const chosenRoute = leftRoute.distance < rightRoute.distance ? leftRoute : rightRoute;
        
        // Calculate direction to the chosen alternative route
        const altDx = chosenRoute.x - this.sprite.x;
        const altDy = chosenRoute.y - this.sprite.y;
        
        return Math.atan2(altDy, altDx);
    }
    
    followTrail() {
        // Find the best pheromone trail in a wider area
        const nearbyPheromones = this.scene.pheromoneSystem.findPheromonesInRadius(
            this.sprite.x,
            this.sprite.y,
            80, // Search radius for trail following
            'food_trail'
        );

        if (nearbyPheromones.length === 0) {
            // No trail found, stop following
            this.state = 'exploring';
            return;
        }

        // Filter for valid food sources
        const validPheromones = nearbyPheromones.filter(({ pheromone }) => {
            const foodSource = this.scene.foodManager.getNearestFoodSource(pheromone.x, pheromone.y, 40);
            return foodSource && !foodSource.isDepleted();
        });

        if (validPheromones.length === 0) {
            this.state = 'exploring';
            return;
        }

        // Calculate the "best" direction by following the pheromone gradient
        // Look for the direction with the strongest pheromone signal
        let bestDirection = null;
        let bestIntensity = 0;
        const searchAngles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4];
        
        for (const angle of searchAngles) {
            const testX = this.sprite.x + Math.cos(angle) * 30;
            const testY = this.sprite.y + Math.sin(angle) * 30;
            
            const testPheromones = this.scene.pheromoneSystem.findPheromonesInRadius(
                testX, testY, 25, 'food_trail'
            );
            
            if (testPheromones.length > 0) {
                // Calculate average intensity in this direction
                const avgIntensity = testPheromones.reduce((sum, { pheromone }) => 
                    sum + pheromone.intensity, 0) / testPheromones.length;
                
                if (avgIntensity > bestIntensity) {
                    bestIntensity = avgIntensity;
                    bestDirection = angle;
                }
            }
        }

        if (bestDirection !== null) {
            // Move toward the direction with the strongest pheromone signal
            this.direction = bestDirection;
            
            // Check if we've reached a food source
            const nearestFood = this.scene.foodManager.getNearestFoodSource(
                this.sprite.x, this.sprite.y, 25
            );
            if (nearestFood && nearestFood.active && !nearestFood.isDepleted()) {
                this.setTarget(nearestFood);
                this.state = 'seeking_food';
            }
        } else {
            // No clear gradient found, try to follow the strongest pheromone directly
            const strongestPheromone = validPheromones[0].pheromone;
            this.target = strongestPheromone;
            
            const dx = strongestPheromone.x - this.sprite.x;
            const dy = strongestPheromone.y - this.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 15) {
                // Reached this pheromone point, look for a stronger one nearby
                const nextPoint = this.findNextTrailPoint();
                if (nextPoint) {
                    this.target = nextPoint;
                    this.direction = Math.atan2(nextPoint.y - this.sprite.y, nextPoint.x - this.sprite.x);
                } else {
                    this.state = 'exploring';
                }
            } else {
                this.direction = Math.atan2(dy, dx);
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
    
    collectFood(foodSource) {
        if (foodSource && foodSource.active && foodSource.amount > 0) {
            const collected = Math.min(this.maxFoodCarry - this.foodAmount, foodSource.amount);
            this.foodAmount += collected;
            foodSource.amount -= collected;

            // Start carrying food as soon as any food is collected
            if (this.foodAmount > 0) {
                this.carryingFood = true;
            }

            if (this.foodAmount >= this.maxFoodCarry) {
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
    
    dropPheromones(time) {
        if (time - this.lastPheromoneDrop > this.pheromoneDropInterval) {
            // Drop stronger pheromones when carrying ANY food (not just full capacity)
            if (this.foodAmount > 0) {
                // Calculate intensity based on food amount
                const intensity = Math.min(1.0 + (this.foodAmount / this.maxFoodCarry) * 1.5, 2.5);
                this.scene.pheromoneSystem.addPheromone(
                    this.sprite.x, 
                    this.sprite.y, 
                    'food_trail', 
                    intensity
                );
                
                // Drop additional pheromones for enhanced trail visibility
                if (this.foodAmount >= this.maxFoodCarry * 0.7) {
                    // Drop a small cluster of pheromones for very strong trails
                    const clusterSize = 3;
                    const angleStep = (Math.PI * 2) / clusterSize;
                    
                    for (let i = 0; i < clusterSize; i++) {
                        const angle = angleStep * i + Math.random() * 0.5;
                        const distance = 8 + Math.random() * 8;
                        const offsetX = Math.cos(angle) * distance;
                        const offsetY = Math.sin(angle) * distance;
                        
                        this.scene.pheromoneSystem.addPheromone(
                            this.sprite.x + offsetX,
                            this.sprite.y + offsetY,
                            'food_trail',
                            intensity * 0.7 // Slightly weaker but still significant
                        );
                    }
                }
            } else if (this.state === 'exploring') {
                // Drop exploration pheromones
                this.scene.pheromoneSystem.addPheromone(
                    this.sprite.x, 
                    this.sprite.y, 
                    'exploration', 
                    0.4 // Slightly stronger exploration pheromones
                );
            }
            this.lastPheromoneDrop = time;
        }
    }
    
    findNearbyPheromoneTrail() {
        // Use the enhanced method with default radius
        return this.findNearbyPheromoneTrailWithRadius(120);
    }
    
    findNextTrailPoint() {
        const trail = this.scene.pheromoneSystem.findStrongestPheromone(
            this.sprite.x,
            this.sprite.y,
            60, // Increased from 30 to 60 for better trail continuity
            'food_trail'
        );

        // Check if the trail leads to an active food source
        if (trail) {
            const foodSource = this.scene.foodManager.getNearestFoodSource(trail.x, trail.y, 30); // Increased search radius
            if (!foodSource || foodSource.isDepleted()) {
                return null; // Don't follow trail to depleted food
            }
        }

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

    getDistance(x, y) {
        const dx = x - this.sprite.x;
        const dy = y - this.sprite.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
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

    updateMovementTrail() {
        // Add current position to trail
        this.movementTrail.push({
            x: this.sprite.x,
            y: this.sprite.y,
            timestamp: Date.now()
        });

        // Keep only recent positions
        if (this.movementTrail.length > this.maxMovementTrail) {
            this.movementTrail.shift();
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

        // Draw trail line
        this.trailGraphics.lineStyle(3, 0xFFFF00, 0.8); // Yellow trail
        this.trailGraphics.beginPath();

        for (let i = 1; i < this.movementTrail.length; i++) {
            const current = this.movementTrail[i];
            const previous = this.movementTrail[i - 1];

            if (i === 1) {
                this.trailGraphics.moveTo(previous.x, previous.y);
            }
            this.trailGraphics.lineTo(current.x, current.y);
        }

        this.trailGraphics.strokePath();
    }

    startFollowing() {
        this.isBeingFollowed = true;
        this.updateTrailGraphics();
        console.log(`Started following ant ${this.id}`);
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
    
    // Method to set a new target (food source)
    setTarget(target) {
        this.target = target;
    }
    
    // Get ant's current position
    getPosition() {
        return { x: this.sprite.x, y: this.sprite.y };
    }
    
    // Check if ant is alive
    isAlive() {
        return this.sprite && this.sprite.active && this.energy > 0;
    }

    handlePuddleDamage(delta) {
        // Check if ant is currently in a puddle
        const puddle = this.scene.puddleSystem.checkAntInPuddle(this);

        if (puddle) {
            if (!this.inPuddle) {
                // Just entered puddle
                this.inPuddle = true;
                this.puddleTime = 0;
                this.puddleDamageApplied = false;
            } else {
                // Still in puddle, accumulate time
                this.puddleTime += delta / 1000; // Convert to seconds

                // Release warning pheromones after 0.4 seconds in puddle
                if (this.puddleTime >= 0.4 && !this.puddleDamageApplied) {
                    this.scene.puddleSystem.releaseWarningPheromones(this, puddle);
                    this.puddleDamageApplied = true;
                }

                // Die after 1.6 seconds in puddle
                if (this.puddleTime >= 1.6) {
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
}
