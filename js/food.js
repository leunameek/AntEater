class FoodSource {
    constructor(scene, x, y, amount = 100, type = null) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.amount = Math.max(0, amount);
        this.maxAmount = this.amount;
        this.active = true;
        this.type = type || FoodSource.getRandomType();
        this.baseScale = 0.5;

        // Prepare sprite frames for this food type
        this.spriteFrames = FoodSource.getFramesForType(this.type);
        this.currentFrameIndex = 0;

        // Create visual representation
        this.sprite = scene.add.sprite(x, y, this.spriteFrames[this.currentFrameIndex]);
        this.sprite.setScale(this.baseScale);
        this.sprite.setDepth(1);

        // Add gentle breathing animation
        this.pulseTween = scene.tweens.add({
            targets: this.sprite,
            scale: this.baseScale * 1.05,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Make it interactive
        this.sprite.setInteractive({ pixelPerfect: true });
        this.sprite.on('pointerover', () => {
            this.sprite.setTint(0xf5f5f5);
        });
        this.sprite.on('pointerout', () => {
            this.sprite.clearTint();
        });
    }
    
    updateVisual() {
        if (!this.active) return;

        if (this.amount <= 0) {
            this.deplete();
            return;
        }

        // Update sprite stage every 20 units consumed
        const consumed = this.maxAmount - this.amount;
        const stage = Math.min(
            Math.floor(consumed / 20),
            this.spriteFrames.length - 1
        );

        if (stage !== this.currentFrameIndex) {
            this.currentFrameIndex = stage;
            this.sprite.setTexture(this.spriteFrames[this.currentFrameIndex]);
        }

        // Slightly reduce size as food is eaten
        const sizeRatio = this.amount / this.maxAmount;
        this.sprite.setScale(this.baseScale * (0.8 + 0.2 * sizeRatio));
    }
    
    collect(amount) {
        if (!this.active || this.amount <= 0) return 0;

        const collected = Math.min(amount, this.amount);
        this.amount -= collected;

        if (this.amount <= 0) {
            this.deplete();
        } else {
            this.updateVisual();
        }

        return collected;
    }
    
    deplete() {
        if (!this.active) return;

        this.active = false;
        this.amount = 0;
        if (this.pulseTween) {
            this.pulseTween.stop();
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

    static getRandomType() {
        const types = Object.keys(FoodSource.SPRITE_CONFIG);
        return types[Math.floor(Math.random() * types.length)];
    }

    static getFramesForType(type) {
        return [1, 2, 3, 4].map(index => `food_${type}_${index}`);
    }

    static preloadAssets(scene) {
        Object.entries(FoodSource.SPRITE_CONFIG).forEach(([key, config]) => {
            for (let i = 1; i <= 4; i++) {
                scene.load.image(
                    `food_${key}_${i}`,
                    `assets/sprites/${key}/${config.baseFile} (${i}).png`
                );
            }
        });
    }
}

FoodSource.SPRITE_CONFIG = {
    hoja: { baseFile: 'Hoja' },
    manzana: { baseFile: 'Manzana' },
    pan: { baseFile: 'Pan' }
};

class FoodManager {
    constructor(scene) {
        this.scene = scene;
        this.foodSources = [];
        this.totalFoodCollected = 0;
    }
    
    createFoodSource(x, y, amount = 100, type = null) {
        const foodSource = new FoodSource(this.scene, x, y, amount, type);
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
            
            this.createFoodSource(x, y, 100);
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
            if (food.pulseTween) {
                food.pulseTween.stop();
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
