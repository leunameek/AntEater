class Colony {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.ants = [];
        this.foodStorage = 500;
        this.population = 0;
        this.maxPopulation = 200;
        this.hasQueen = false;
        this.roles = ['worker', 'soldier', 'scout', 'forager', 'nurse'];
        
        // Create colony visual
        this.sprite = scene.add.circle(x, y, 60, 0xFF6347);
        this.sprite.setStrokeStyle(3, 0xFFFFFF);
        
        // Add colony entrance
        this.entrance = scene.add.circle(x, y, 16, 0x000000);
        
        // Add pulsing effect
        this.pulseTween = scene.tweens.add({
            targets: this.sprite,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Colony stats
        this.totalAntsBorn = 0;
        this.totalAntsDied = 0;
        this.generation = 1;
        
        // Spawning properties
        this.spawnTimer = 0;
        this.spawnInterval = 5000; // Spawn new ant every 5 seconds
        this.spawnCost = 10; // Food cost to spawn new ant

        // Queen reproduction
        this.queenReproductionTimer = 0;
        this.queenReproductionInterval = 60000; // 1 minute for reproduction cycle
        this.nuptialFlightThreshold = 300; // Food needed for nuptial flight
        this.nuptialFlightActive = false;
        this.nuptialFlightDuration = 10000; // 10 seconds flight
        this.nuptialFlightTimer = 0;
        this.postFlightTimer = 0;
        
    }
    
    spawnAnt() {
        if (this.ants.length >= this.maxPopulation) return null;
        if (this.foodStorage < this.spawnCost) return null;

        // Assign role
        let role;
        if (!this.hasQueen && Math.random() < 0.05) { // 5% chance for queen if not present
            role = 'queen';
            this.hasQueen = true;
        } else {
            role = this.roles[Math.floor(Math.random() * this.roles.length)];
        }
        
        // Spend food to spawn ant
        this.foodStorage -= this.spawnCost;
        
        // Create new ant with some randomness in position
        const spawnX = this.x + (Math.random() - 0.5) * 40;
        const spawnY = this.y + (Math.random() - 0.5) * 40;
        
        const ant = new Ant(this.scene, spawnX, spawnY, this, role);
        this.ants.push(ant);
        this.population = this.ants.length;
        this.totalAntsBorn++;
        
        // Create spawn effect
        this.createSpawnEffect(spawnX, spawnY);
        
        return ant;
    }
    
    createSpawnEffect(x, y) {
        const spawnEffect = this.scene.add.circle(x, y, 10, 0x00FF00, 0.7);
        
        this.scene.tweens.add({
            targets: spawnEffect,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 500,
            onComplete: () => spawnEffect.destroy()
        });
    }
    
    update(time, delta) {
        // Update all ants
        for (let i = this.ants.length - 1; i >= 0; i--) {
            const ant = this.ants[i];
            if (ant.isAlive()) {
                ant.update(time, delta);
            } else {
                this.ants.splice(i, 1);
                this.totalAntsDied++;
            }
        }
        
        this.population = this.ants.length;
        
        // Spawn new ants
        this.spawnTimer += delta;
        if (this.spawnTimer >= this.spawnInterval && this.foodStorage >= this.spawnCost) {
            this.spawnAnt();
            this.spawnTimer = 0;
        }

        // Queen reproduction
        if (this.hasQueen) {
            if (this.nuptialFlightActive) {
                this.nuptialFlightTimer += delta;
                if (this.nuptialFlightTimer >= this.nuptialFlightDuration) {
                    this.nuptialFlightActive = false;
                    this.nuptialFlightTimer = 0;
                    this.postFlightTimer = 0; // Start post-flight timer
                    console.log('Queen returned from nuptial flight');
                }
            } else if (this.postFlightTimer >= 0) {
                this.postFlightTimer += delta;
                if (this.postFlightTimer >= 10000) { // 10 seconds after flight, spawn brood
                    const broodCount = Math.floor(Math.random() * 3) + 1; // 1-3 new ants
                    for (let i = 0; i < broodCount; i++) {
                        this.spawnAnt();
                    }
                    this.postFlightTimer = -1; // Disable
                    console.log(`Queen produced ${broodCount} new ants`);
                }
            } else {
                this.queenReproductionTimer += delta;
                if (this.queenReproductionTimer >= this.queenReproductionInterval) {
                    if (this.foodStorage >= this.nuptialFlightThreshold) {
                        // Start nuptial flight
                        this.nuptialFlightActive = true;
                        this.foodStorage -= this.nuptialFlightThreshold; // Cost for flight
                        console.log('Queen starting nuptial flight');
                    } else {
                        // Not enough food, reset timer
                        this.queenReproductionTimer = 0;
                    }
                }
            }
        }
        
        // Update colony visual based on food storage
        this.updateVisuals();
    }
    
    updateVisuals() {
        // Change colony color based on food storage
        if (this.foodStorage > 100) {
            this.sprite.setFillStyle(0x228B22); // Green - well fed
        } else if (this.foodStorage > 50) {
            this.sprite.setFillStyle(0xFFD700); // Gold - moderate food
        } else if (this.foodStorage > 20) {
            this.sprite.setFillStyle(0xFFA500); // Orange - low food
        } else {
            this.sprite.setFillStyle(0x8B0000); // Red - starving
        }
        
        // Change size based on population
        const sizeMultiplier = 1 + (this.population / this.maxPopulation) * 0.5;
        this.sprite.setRadius(50 * sizeMultiplier);
    }
    
    addFood(amount) {
        this.foodStorage += amount;
        
        // Create food deposit effect
        this.createFoodDepositEffect();
    }
    
    createFoodDepositEffect() {
        const depositEffect = this.scene.add.circle(
            this.x + (Math.random() - 0.5) * 20,
            this.y + (Math.random() - 0.5) * 20,
            3,
            0x00FF00,
            0.8
        );
        
        this.scene.tweens.add({
            targets: depositEffect,
            y: depositEffect.y - 20,
            alpha: 0,
            duration: 1000,
            onComplete: () => depositEffect.destroy()
        });
    }
    
    removeAnt(ant) {
        const index = this.ants.indexOf(ant);
        if (index !== -1) {
            this.ants.splice(index, 1);
            this.population = this.ants.length;
        }
    }
    
    getAntsInRadius(x, y, radius) {
        return this.ants.filter(ant => {
            const distance = Math.sqrt(
                (ant.sprite.x - x) ** 2 + (ant.sprite.y - y) ** 2
            );
            return distance <= radius;
        });
    }
    
    getActiveAnts() {
        return this.ants.filter(ant => ant.isAlive());
    }
    
    getAntsByState(state) {
        return this.ants.filter(ant => ant.state === state);
    }
    
    
    getStats() {
        const activeAnts = this.getActiveAnts();
        const states = {
            exploring: this.getAntsByState('exploring').length,
            seeking_food: this.getAntsByState('seeking_food').length,
            returning_home: this.getAntsByState('returning_home').length,
            following_trail: this.getAntsByState('following_trail').length
        };
        
        return {
            population: this.population,
            maxPopulation: this.maxPopulation,
            foodStorage: this.foodStorage,
            totalAntsBorn: this.totalAntsBorn,
            totalAntsDied: this.totalAntsDied,
            generation: this.generation,
            antStates: states,
            efficiency: this.totalAntsBorn > 0 ? (this.totalAntsBorn - this.totalAntsDied) / this.totalAntsBorn : 1
        };
    }
    
    // Method to assign food targets to ants
    assignFoodTargets(foodManager) {
        const seekingAnts = this.getAntsByState('exploring');
        
        for (const ant of seekingAnts) {
            if (!ant.target) {
                const nearestFood = foodManager.getNearestFoodSource(
                    ant.sprite.x, 
                    ant.sprite.y, 
                    300
                );
                
                if (nearestFood) {
                    ant.setTarget(nearestFood);
                }
            }
        }
    }
    
    // Method to handle colony evolution/adaptation
    evolve() {
        this.generation++;
        
        // Increase spawn efficiency over time
        this.spawnCost = Math.max(5, this.spawnCost - 1);
        
        // Slightly increase max population
        this.maxPopulation = Math.min(300, this.maxPopulation + 5);
    }
    
    // Emergency food distribution
    emergencyFoodDistribution() {
        if (this.foodStorage < 10) {
            // Give all ants a small energy boost
            for (const ant of this.ants) {
                ant.energy = Math.min(ant.maxEnergy, ant.energy + 10);
            }
        }
    }
    
    destroy() {
        // Destroy all ants
        for (const ant of this.ants) {
            if (ant.sprite) {
                ant.sprite.destroy();
            }
        }

        // Destroy colony visuals
        if (this.sprite) this.sprite.destroy();
        if (this.entrance) this.entrance.destroy();
        if (this.pulseTween) this.pulseTween.destroy();
    }
}
