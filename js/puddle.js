class PuddleSystem {
    constructor(scene) {
        this.scene = scene;
        this.puddles = [];
        this.maxPuddles = 10; // Maximum number of puddles on the map
        this.puddleSpawnChance = 0.001; // Chance to spawn a puddle per update cycle
        this.dangerPheromoneStrength = 2.0; // Strength of danger pheromones from deaths
    }

    createPuddle(x, y, radius = 30 + Math.random() * 20) {
        const puddle = {
            x: x,
            y: y,
            radius: radius,
            sprite: this.scene.add.circle(x, y, radius, 0x4169E1, 0.6), // Blue color with transparency
            active: true,
            deathCount: 0 // Track how many ants have died here
        };

        // Add physics body for collision detection
        this.scene.physics.add.existing(puddle.sprite, true); // true = static body
        puddle.sprite.body.setCircle(radius);

        // Add ripple effect
        this.addRippleEffect(puddle);

        this.puddles.push(puddle);
        return puddle;
    }

    addRippleEffect(puddle) {
        // Create subtle ripple animation
        this.scene.tweens.add({
            targets: puddle.sprite,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 2000 + Math.random() * 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    spawnRandomPuddles(worldWidth, worldHeight, count = 3) {
        for (let i = 0; i < count; i++) {
            let x, y;
            let attempts = 0;
            const maxAttempts = 50;

            do {
                x = Math.random() * worldWidth;
                y = Math.random() * worldHeight;
                attempts++;
            } while (this.isNearColony(x, y, worldWidth, worldHeight) && attempts < maxAttempts);

            if (attempts < maxAttempts) {
                this.createPuddle(x, y);
            }
        }
    }

    isNearColony(x, y, worldWidth, worldHeight) {
        const colonyX = worldWidth / 2;
        const colonyY = worldHeight / 2;
        const distance = Math.sqrt((x - colonyX) ** 2 + (y - colonyY) ** 2);
        return distance < 150; // Don't place puddles within 150 pixels of colony
    }

    checkAntCollision(ant) {
        if (!ant.isAlive()) return false;

        for (const puddle of this.puddles) {
            if (!puddle.active) continue;

            const distance = Math.sqrt(
                (ant.sprite.x - puddle.x) ** 2 + (ant.sprite.y - puddle.y) ** 2
            );

            if (distance <= puddle.radius) {
                // Ant is in the puddle - damage over time instead of immediate death
                return true;
            }
        }

        return false;
    }

    checkAntInPuddle(ant) {
        return this.checkAntCollision(ant);
    }

    handleAntDeathInPuddle(ant, puddle) {
        // Ant dies immediately when entering puddle
        ant.die();

        // Increment death count for this puddle
        puddle.deathCount++;

        // Release strong danger pheromones around the death location
        this.releaseDangerPheromones(puddle.x, puddle.y, puddle.deathCount);

        // Also release pheromones at the ant's exact death location for more precise marking
        this.scene.pheromoneSystem.addPheromone(ant.sprite.x, ant.sprite.y, 'danger', 4.0);

        // Create drowning effect
        this.createDrowningEffect(puddle.x, puddle.y);

        console.log(`Ant ${ant.id} drowned in puddle at (${puddle.x}, ${puddle.y})`);
    }

    releaseDangerPheromones(x, y, deathCount) {
        // Release danger pheromones in a larger radius around the death location
        const pheromoneRadius = 80; // Increased from 50
        const numPheromones = Math.min(deathCount * 8, 30); // More pheromones for better learning

        for (let i = 0; i < numPheromones; i++) {
            const angle = (Math.PI * 2 * i) / numPheromones;
            const distance = Math.random() * pheromoneRadius;
            const px = x + Math.cos(angle) * distance;
            const py = y + Math.sin(angle) * distance;

            // Strength based on death count (more deaths = stronger warning)
            const strength = Math.min(this.dangerPheromoneStrength * (deathCount / 3), 4.0); // Increased max strength

            this.scene.pheromoneSystem.addPheromone(px, py, 'danger', strength);
        }
    }

    createDrowningEffect(x, y) {
        // Create a ripple effect at the drowning location
        const ripple = this.scene.add.circle(x, y, 5, 0xFFFFFF, 0.8);
        ripple.setDepth(10);

        this.scene.tweens.add({
            targets: ripple,
            scaleX: 3,
            scaleY: 3,
            alpha: 0,
            duration: 1500,
            onComplete: () => ripple.destroy()
        });
    }

    update(time, delta) {
        // Randomly spawn new puddles occasionally
        if (this.puddles.length < this.maxPuddles && Math.random() < this.puddleSpawnChance) {
            const { width, height } = this.scene.cameras.main.getBounds();
            this.spawnRandomPuddles(width, height, 1);
        }

        // Check all ants for puddle collisions (for danger pheromone release on death)
        for (const ant of this.scene.colony.ants) {
            if (this.checkAntCollision(ant) && ant.energy <= 0) {
                // Ant died in puddle, release pheromones
                const puddle = this.getPuddleAt(ant.sprite.x, ant.sprite.y);
                if (puddle) {
                    puddle.deathCount++;
                    this.releaseDangerPheromones(puddle.x, puddle.y, puddle.deathCount);
                    this.scene.pheromoneSystem.addPheromone(ant.sprite.x, ant.sprite.y, 'danger', 4.0);
                    this.createDrowningEffect(puddle.x, puddle.y);
                }
            }
        }
    }

    clear() {
        for (const puddle of this.puddles) {
            if (puddle.sprite) {
                puddle.sprite.destroy();
            }
        }
        this.puddles = [];
    }

    getStats() {
        return {
            totalPuddles: this.puddles.length,
            activePuddles: this.puddles.filter(p => p.active).length,
            totalDeaths: this.puddles.reduce((sum, p) => sum + p.deathCount, 0)
        };
    }

    getPuddleAt(x, y) {
        for (const puddle of this.puddles) {
            if (!puddle.active) continue;
            const distance = Math.sqrt((x - puddle.x) ** 2 + (y - puddle.y) ** 2);
            if (distance <= puddle.radius) {
                return puddle;
            }
        }
        return null;
    }
}