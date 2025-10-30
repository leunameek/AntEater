class FoodSource {
    constructor(scene, x, y, amount = 100) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.amount = amount;
        this.maxAmount = amount;
        this.active = true;
        
        // Create visual representation
        this.sprite = scene.add.circle(x, y, 30, 0xFFD700); // Gold color
        this.sprite.setStrokeStyle(2, 0xFFA500);
        
        // Add pulsing animation
        this.pulseTween = scene.tweens.add({
            targets: this.sprite,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Add some sparkle effects
        this.createSparkleEffect();
        
        // Make it interactive
        this.sprite.setInteractive();
        this.sprite.on('pointerover', () => {
            this.sprite.setStrokeStyle(3, 0xFF6347);
        });
        this.sprite.on('pointerout', () => {
            this.sprite.setStrokeStyle(2, 0xFFA500);
        });
    }
    
    updateVisual() {
        if (!this.active) return;
        
        // Update size based on remaining amount
        const sizeRatio = this.amount / this.maxAmount;
        const newRadius = Math.max(10, 30 * sizeRatio);
        
        this.sprite.setRadius(newRadius);
        
        // Change color based on amount
        if (sizeRatio > 0.7) {
            this.sprite.setFillStyle(0xFFD700); // Gold
        } else if (sizeRatio > 0.3) {
            this.sprite.setFillStyle(0xFFA500); // Orange
        } else {
            this.sprite.setFillStyle(0xFF6347); // Red-orange
        }
        
        // Remove sparkles when almost empty
        if (sizeRatio < 0.2) {
            this.pulseTween.stop();
        }
    }
    
    createSparkleEffect() {
        // Create random sparkles around the food source
        for (let i = 0; i < 5; i++) {
            const sparkle = this.scene.add.circle(
                this.x + (Math.random() - 0.5) * 30,
                this.y + (Math.random() - 0.5) * 30,
                1,
                0xFFFFFF,
                0.8
            );
            
            this.scene.tweens.add({
                targets: sparkle,
                alpha: 0,
                scaleX: 2,
                scaleY: 2,
                duration: 2000 + Math.random() * 1000,
                yoyo: true,
                repeat: -1,
                delay: Math.random() * 1000
            });
        }
    }
    
    collect(amount) {
        const collected = Math.min(amount, this.amount);
        this.amount -= collected;

        // Set a timer for destruction if this is the last bit of food
        if (this.amount <= 0) {
            this.deplete();
        } else {
            this.updateVisual();
            // If only a tiny amount remains, start destruction timer
            if (this.amount <= 1) {
                this.startDestructionTimer();
            }
        }

        return collected;
    }

    startDestructionTimer() {
        // If not already set, start a timer to destroy remaining food
        if (!this.destructionTimer) {
            this.destructionTimer = this.scene.time.delayedCall(5000, () => { // 5 seconds
                if (this.amount > 0 && this.amount <= 1) {
                    this.forceDeplete();
                }
            });
        }
    }

    forceDeplete() {
        this.amount = 0;
        this.deplete();
    }
    
    deplete() {
        this.active = false;
        if (this.pulseTween) {
            this.pulseTween.stop();
        }
        if (this.destructionTimer) {
            this.destructionTimer.destroy();
        }

        // Create depletion effect
        const depletionEffect = this.scene.add.circle(
            this.x,
            this.y,
            20,
            0x8B0000,
            0.5
        );

        this.scene.tweens.add({
            targets: depletionEffect,
            alpha: 0,
            scaleX: 3,
            scaleY: 3,
            duration: 1000,
            onComplete: () => {
                depletionEffect.destroy();
                this.sprite.destroy();
            }
        });
    }
    
    isDepleted() {
        return !this.active || this.amount <= 0;
    }
    
    getPosition() {
        return { x: this.x, y: this.y };
    }
}

class FoodManager {
    constructor(scene) {
        this.scene = scene;
        this.foodSources = [];
        this.totalFoodCollected = 0;
    }
    
    createFoodSource(x, y, amount = 100) {
        const foodSource = new FoodSource(this.scene, x, y, amount);
        this.foodSources.push(foodSource);
        return foodSource;
    }
    
    createRandomFoodSources(count, worldWidth, worldHeight) {
        this.foodSources = [];
        
        for (let i = 0; i < count; i++) {
            // Avoid center area where colony is
            let x, y;
            do {
                x = Math.random() * worldWidth;
                y = Math.random() * worldHeight;
            } while (this.isNearColony(x, y, worldWidth, worldHeight));
            
            const amount = 50 + Math.random() * 150; // Random amount between 50-200
            this.createFoodSource(x, y, amount);
        }
    }
    
    isNearColony(x, y, worldWidth, worldHeight) {
        const colonyX = worldWidth / 2;
        const colonyY = worldHeight / 2;
        const distance = Math.sqrt((x - colonyX) ** 2 + (y - colonyY) ** 2);
        return distance < 100; // Don't place food within 100 pixels of colony
    }
    
    update() {
        // Remove depleted food sources
        this.foodSources = this.foodSources.filter(food => !food.isDepleted());
    }
    
    getNearestFoodSource(x, y, maxDistance = 300) {
        let nearest = null;
        let nearestDistance = maxDistance;
        
        for (const food of this.foodSources) {
            if (!food.active) continue;
            
            const distance = Math.sqrt(
                (food.x - x) ** 2 + (food.y - y) ** 2
            );
            
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = food;
            }
        }
        
        return nearest;
    }
    
    getFoodSourcesInRadius(x, y, radius) {
        return this.foodSources.filter(food => {
            if (!food.active) return false;
            
            const distance = Math.sqrt(
                (food.x - x) ** 2 + (food.y - y) ** 2
            );
            
            return distance <= radius;
        });
    }
    
    addFoodCollected(amount) {
        this.totalFoodCollected += amount;
    }
    
    getStats() {
        return {
            totalSources: this.foodSources.length,
            activeSources: this.foodSources.filter(f => f.active).length,
            totalFoodCollected: this.totalFoodCollected,
            totalRemainingFood: this.foodSources.reduce((sum, f) => sum + f.amount, 0)
        };
    }
    
    clear() {
        for (const food of this.foodSources) {
            if (food.sprite) {
                food.sprite.destroy();
            }
        }
        this.foodSources = [];
        this.totalFoodCollected = 0;
    }
    
    respawnFoodSources(count, worldWidth, worldHeight) {
        this.clear();
        this.createRandomFoodSources(count, worldWidth, worldHeight);
    }
}
