class Termite {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;

        // Create termite sprite
        this.sprite = scene.add.circle(x, y, 20, 0x8B4513); // Brown color
        this.sprite.setStrokeStyle(2, 0x654321);
        scene.physics.add.existing(this.sprite);

        // Physics properties
        this.sprite.body.setCollideWorldBounds(true);
        this.sprite.body.setBounce(0.1);
        this.sprite.body.setDrag(30);

        // Termite properties
        this.speed = 60 + Math.random() * 20;
        this.health = 50;
        this.maxHealth = 50;
        this.damage = 10;
        this.attackRange = 15;
        this.attackCooldown = 0;
        this.attackCooldownTime = 1000; // 1 second

        // Behavior
        this.state = 'seeking'; // seeking, attacking_food, attacking_colony, attacking_ant
        this.target = null;

        // Movement
        this.direction = Math.random() * Math.PI * 2;
        this.wanderAngle = 0;
        this.wanderRadius = 20;
        this.wanderDistance = 40;
        this.wanderJitter = 0.4;

        // Set initial velocity
        this.updateMovement();
    }

    update(time, delta) {
        this.attackCooldown = Math.max(0, this.attackCooldown - delta);

        if (this.health <= 0) {
            this.die();
            return;
        }

        // Update state
        this.updateState();

        // Execute behavior
        switch (this.state) {
            case 'seeking':
                this.seekTarget();
                break;
            case 'attacking_food':
                this.attackFood();
                break;
            case 'attacking_colony':
                this.attackColony();
                break;
            case 'attacking_ant':
                this.attackAnt();
                break;
        }

        // Update movement
        this.updateMovement();

        // Update visual
        this.updateVisuals();
    }

    updateState() {
        // Check if any soldiers are alive
        const soldiersAlive = this.scene.colony.ants.some(ant => ant.role === 'soldier' && ant.isAlive());

        // Find nearest target
        const nearestFood = this.findNearestFood();
        const colonyDistance = this.getDistanceToColony();
        let nearestAnt = null;

        if (!soldiersAlive) {
            // If no soldiers, attack any ant
            nearestAnt = this.findNearestAnt();
        } else {
            // Only attack non-soldier ants if very close, otherwise focus on food/colony
            nearestAnt = this.findNearestNonSoldierAnt();
        }

        // Prioritize: food > colony > ants
        if (nearestFood && this.getDistance(nearestFood.x, nearestFood.y) < 200) {
            this.state = 'attacking_food';
            this.target = nearestFood;
        } else if (colonyDistance < 150) {
            this.state = 'attacking_colony';
            this.target = this.scene.colony;
        } else if (nearestAnt && this.getDistance(nearestAnt.sprite.x, nearestAnt.sprite.y) < (soldiersAlive ? 50 : 100)) {
            this.state = 'attacking_ant';
            this.target = nearestAnt;
        } else {
            this.state = 'seeking';
            this.target = null;
        }
    }

    seekTarget() {
        // Wander towards colony
        const colonyX = this.scene.cameras.main.width / 2;
        const colonyY = this.scene.cameras.main.height / 2;
        const dx = colonyX - this.sprite.x;
        const dy = colonyY - this.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 50) {
            this.direction = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
        } else {
            // Wander randomly
            this.wanderAngle += (Math.random() - 0.5) * this.wanderJitter;
            const targetX = this.sprite.x + Math.cos(this.wanderAngle) * this.wanderDistance;
            const targetY = this.sprite.y + Math.sin(this.wanderAngle) * this.wanderDistance;
            this.direction = Math.atan2(targetY - this.sprite.y, targetX - this.sprite.x);
        }
    }

    attackFood() {
        if (this.target && this.target.active) {
            const dx = this.target.x - this.sprite.x;
            const dy = this.target.y - this.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.attackRange) {
                this.performAttack();
            } else {
                this.direction = Math.atan2(dy, dx);
            }
        } else {
            this.state = 'seeking';
        }
    }

    attackColony() {
        const dx = this.scene.colony.x - this.sprite.x;
        const dy = this.scene.colony.y - this.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.attackRange + 30) { // Colony has larger hitbox
            this.performAttack();
        } else {
            this.direction = Math.atan2(dy, dx);
        }
    }

    attackAnt() {
        if (this.target && this.target.isAlive()) {
            const dx = this.target.sprite.x - this.sprite.x;
            const dy = this.target.sprite.y - this.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.attackRange) {
                this.performAttack();
            } else {
                this.direction = Math.atan2(dy, dx);
            }
        } else {
            this.state = 'seeking';
        }
    }

    performAttack() {
        if (this.attackCooldown <= 0) {
            if (this.state === 'attacking_food' && this.target) {
                // Termites destroy food sources completely
                this.target.amount = 0;
                this.target.updateVisual();
                this.attackCooldown = this.attackCooldownTime;
            } else if (this.state === 'attacking_colony') {
                this.scene.colony.foodStorage = Math.max(0, this.scene.colony.foodStorage - this.damage);
                this.attackCooldown = this.attackCooldownTime;
            } else if (this.state === 'attacking_ant' && this.target) {
                this.target.energy = Math.max(0, this.target.energy - this.damage);
                if (this.target.energy <= 0) {
                    this.target.die();
                }
                this.attackCooldown = this.attackCooldownTime;
            }
        }
    }

    findNearestFood() {
        let nearest = null;
        let minDistance = Infinity;

        for (const food of this.scene.foodManager.foodSources) {
            if (!food.active) continue;
            const distance = this.getDistance(food.x, food.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = food;
            }
        }

        return nearest;
    }

    findNearestAnt() {
        let nearest = null;
        let minDistance = Infinity;

        for (const ant of this.scene.colony.ants) {
            if (!ant.isAlive()) continue;
            const distance = this.getDistance(ant.sprite.x, ant.sprite.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = ant;
            }
        }

        return nearest;
    }

    findNearestNonSoldierAnt() {
        let nearest = null;
        let minDistance = Infinity;

        for (const ant of this.scene.colony.ants) {
            if (!ant.isAlive() || ant.role === 'soldier') continue;
            const distance = this.getDistance(ant.sprite.x, ant.sprite.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = ant;
            }
        }

        return nearest;
    }

    getDistanceToColony() {
        const dx = this.scene.colony.x - this.sprite.x;
        const dy = this.scene.colony.y - this.sprite.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getDistance(x, y) {
        const dx = x - this.sprite.x;
        const dy = y - this.sprite.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    updateMovement() {
        const speedVariation = 0.8 + Math.random() * 0.4;
        const currentSpeed = this.speed * speedVariation;

        this.sprite.body.setVelocity(
            Math.cos(this.direction) * currentSpeed,
            Math.sin(this.direction) * currentSpeed
        );
    }

    updateVisuals() {
        // Change color based on state
        if (this.state === 'attacking_food') {
            this.sprite.setFillStyle(0xA0522D); // Darker brown
        } else if (this.state === 'attacking_colony') {
            this.sprite.setFillStyle(0x8B0000); // Dark red
        } else if (this.state === 'attacking_ant') {
            this.sprite.setFillStyle(0xFF4500); // Orange red
        } else {
            this.sprite.setFillStyle(0x8B4513); // Normal brown
        }

        // Health indicator
        const healthRatio = this.health / this.maxHealth;
        if (healthRatio < 0.5) {
            this.sprite.setStrokeStyle(2, 0xFF0000); // Red outline when low health
        } else {
            this.sprite.setStrokeStyle(2, 0x654321);
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        // Death effect
        const deathEffect = this.scene.add.circle(
            this.sprite.x,
            this.sprite.y,
            16,
            0x654321,
            0.7
        );

        this.scene.tweens.add({
            targets: deathEffect,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 500,
            onComplete: () => deathEffect.destroy()
        });

        this.sprite.destroy();
    }

    isAlive() {
        return this.sprite && this.sprite.active && this.health > 0;
    }
}