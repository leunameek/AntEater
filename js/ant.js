class Ant {
    constructor(scene, x, y, colony, role) {
        this.scene = scene;
        this.colony = colony;
        this.role = role || 'worker';
        this.id = colony.totalAntsBorn + 1; // Unique ID

        // Create temporal ant sprite
        this.sprite = scene.add.circle(x, y, 16, 0xFF4500);
        this.sprite.setStrokeStyle(2, 0xFFFFFF);
        scene.physics.add.existing(this.sprite);

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
        
        // Set initial velocity
        this.updateMovement();
    }
    
    update(time, delta) {
        this.energy -= 0.1 * delta / 1000; // Energy decreases over time
        this.lifespan += delta / 1000; // Track lifespan

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
        }

        // Drop pheromones
        this.dropPheromones(time);

        // Update movement
        this.updateMovement();

        // Update visual appearance
        this.updateVisuals();
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

        if (this.carryingFood) {
            this.state = 'returning_home';
        } else if (this.target && this.target.active) {
            this.state = 'seeking_food';
        } else {
            // Check for nearby pheromone trails
            const nearbyTrail = this.findNearbyPheromoneTrail();
            if (nearbyTrail && !this.carryingFood) {
                this.state = 'following_trail';
                this.target = nearbyTrail;
            } else {
                this.state = 'exploring';
            }
        }
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
        if (this.target && this.target.active) {
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
        if (this.target && this.target.active) {
            const dx = this.target.x - this.sprite.x;
            const dy = this.target.y - this.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 15) {
                // Reached trail point, look for next one
                this.target = this.findNextTrailPoint();
                if (!this.target) {
                    this.state = 'exploring';
                }
            } else {
                this.direction = Math.atan2(dy, dx);
            }
        } else {
            this.state = 'exploring';
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
            
            if (this.foodAmount >= this.maxFoodCarry) {
                this.carryingFood = true;
                this.target = null;
            }
            
            // Update food source visual
            foodSource.updateVisual();
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
        return this.scene.pheromoneSystem.findStrongestPheromone(
            this.sprite.x, 
            this.sprite.y, 
            50, 
            'food_trail'
        );
    }
    
    findNextTrailPoint() {
        return this.scene.pheromoneSystem.findStrongestPheromone(
            this.sprite.x,
            this.sprite.y,
            30,
            'food_trail'
        );
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
        // Change color based on state
        if (this.scene.attackActive && this.role === 'soldier') {
            this.sprite.setFillStyle(0xDC143C); // Crimson red for soldiers during attack
        } else if (this.carryingFood) {
            this.sprite.setFillStyle(0x00FF00); // Bright green when carrying food
        } else if (this.state === 'seeking_food') {
            this.sprite.setFillStyle(0xFF8C00); // Bright orange when seeking food
        } else if (this.state === 'returning_home') {
            this.sprite.setFillStyle(0x4169E1); // Royal blue when returning home
        } else if (this.state === 'hiding') {
            this.sprite.setFillStyle(0x808080); // Gray when hiding
        } else {
            this.sprite.setFillStyle(0xFF4500); // Orange red when exploring
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
            this.sprite.fillColor,
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

        // Destroy ant sprite
        this.sprite.destroy();
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
