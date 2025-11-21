class ObstacleSystem {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
    }

    spawnRandomObstacles(count, worldWidth, worldHeight) {
        this.clear();
        const colonyX = worldWidth / 2;
        const colonyY = worldHeight / 2;

        for (let i = 0; i < count; i++) {
            let x, y;
            let attempts = 0;

            do {
                x = Math.random() * worldWidth;
                y = Math.random() * worldHeight;
                attempts++;
            } while (this.isNearColony(x, y, colonyX, colonyY) && attempts < 20);

            this.createObstacle(x, y);
        }
    }

    isNearColony(x, y, colonyX, colonyY) {
        const distance = Math.sqrt((x - colonyX) ** 2 + (y - colonyY) ** 2);
        return distance < 120;
    }

    createObstacle(x, y, width = null, height = null) {
        const type = Math.random() < 0.55 ? 'rock' : 'stick';

        if (type === 'rock') {
            const radius = width ? Math.max(width, height || width) / 2 : 12 + Math.random() * 20;
            const grayPalette = [0x7d7d7d, 0x8a8a8a, 0x9c9c9c];
            const sprite = this.scene.add.ellipse(
                x,
                y,
                radius * 2,
                radius * 2,
                Phaser.Utils.Array.GetRandom(grayPalette),
                0.92
            );
            sprite.setDepth(-0.5);

            this.obstacles.push({
                type,
                x,
                y,
                radius,
                sprite
            });
        } else {
            width = width || 16 + Math.random() * 24;
            height = height || 70 + Math.random() * 80;
            const angle = Math.random() * Math.PI;
            const color = 0x8b6f51;
            const sprite = this.scene.add.rectangle(x, y, width, height, color, 0.9);
            sprite.setDepth(-0.5);
            sprite.setRotation(angle);

            // Approximate stick radius for avoidance
            const radius = Math.max(width, height) / 2;

            this.obstacles.push({
                type,
                x,
                y,
                radius,
                angle,
                sprite
            });
        }
    }

    getClosestObstacle(x, y, maxDistance = 80) {
        let closest = null;
        let closestDistance = maxDistance;

        for (const obstacle of this.obstacles) {
            const distance = Math.sqrt((x - obstacle.x) ** 2 + (y - obstacle.y) ** 2) - obstacle.radius;

            if (distance < closestDistance) {
                closestDistance = distance;
                closest = obstacle;
            }
        }

        return closest ? { obstacle: closest, distance: closestDistance } : null;
    }

    getBlockingSteer(x, y, direction, cautious = false) {
        const lookAhead = cautious ? 140 : 100;
        const safetyBuffer = cautious ? 28 : 18;
        const headingX = Math.cos(direction);
        const headingY = Math.sin(direction);

        let targetObstacle = null;
        let urgencyScore = -Infinity;

        for (const obstacle of this.obstacles) {
            const toObsX = obstacle.x - x;
            const toObsY = obstacle.y - y;
            const forwardDist = toObsX * headingX + toObsY * headingY; // projection on heading
            const lateralDist = Math.abs(toObsX * headingY - toObsY * headingX); // perpendicular distance
            const inflatedRadius = obstacle.radius + safetyBuffer;

            // Only consider obstacles that are roughly ahead (or we're already overlapping)
            if (forwardDist < -inflatedRadius || forwardDist > lookAhead + inflatedRadius) continue;

            const overlap = inflatedRadius - lateralDist;

            if (overlap > 0 || forwardDist < inflatedRadius) {
                // Higher score = closer/more urgent
                const score = overlap + (lookAhead - forwardDist) * 0.2;
                if (score > urgencyScore) {
                    urgencyScore = score;
                    targetObstacle = obstacle;
                }
            }
        }

        if (!targetObstacle) return null;

        // Steer away from the obstacle using the sign of the cross product
        const toObsX = targetObstacle.x - x;
        const toObsY = targetObstacle.y - y;
        const sign = Math.sign(toObsX * headingY - toObsY * headingX) || (Math.random() < 0.5 ? -1 : 1);
        const baseTurn = cautious ? 0.35 : 0.25;
        const steer = sign * (baseTurn + Phaser.Math.Clamp(urgencyScore / 80, 0, 0.4));

        return steer;
    }

    clear() {
        for (const obstacle of this.obstacles) {
            if (obstacle.sprite) {
                obstacle.sprite.destroy();
            }
        }
        this.obstacles = [];
    }
}
