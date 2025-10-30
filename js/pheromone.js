class PheromoneSystem {
    constructor(scene) {
        this.scene = scene;
        this.pheromones = [];
        this.decayRate = 0.001; // Even slower decay for longer-lasting pheromones
        this.maxPheromones = 2000; // Increased maximum for more persistent pheromones
        this.gridSize = 20; // Size of pheromone grid cells
        this.pheromoneGrid = new Map(); // Spatial hash for efficient lookup

        // Visual representation
        this.pheromoneGraphics = scene.add.graphics();
        this.updateInterval = 100; // Update visuals every 100ms
        this.lastVisualUpdate = 0;
    }
    
    addPheromone(x, y, type, intensity = 1.0) {
        // Make danger pheromones much stronger and longer-lasting
        let adjustedIntensity = intensity;
        if (type === 'danger') {
            adjustedIntensity = Math.min(intensity * 3.0, 5.0); // Danger pheromones are 3x stronger, max 5.0
        } else if (type === 'food_trail') {
            adjustedIntensity = Math.min(intensity * 2.5, 3.0); // Food trails much stronger for better detection
        }

        // Create new pheromone
        const pheromone = {
            x: x,
            y: y,
            type: type, // 'food_trail', 'exploration', 'danger'
            intensity: Math.min(adjustedIntensity, 5.0), // Allow higher intensity
            maxIntensity: adjustedIntensity,
            age: 0,
            id: Date.now() + Math.random(),
            trailLength: type === 'food_trail' ? 1 : 0, // Track how many ants are following this trail
            lastFollowerCount: 0
        };
        
        this.pheromones.push(pheromone);
        
        // Add to spatial grid
        const gridKey = this.getGridKey(x, y);
        if (!this.pheromoneGrid.has(gridKey)) {
            this.pheromoneGrid.set(gridKey, []);
        }
        this.pheromoneGrid.get(gridKey).push(pheromone);
        
        // Remove oldest pheromones if we exceed the limit
        if (this.pheromones.length > this.maxPheromones) {
            this.pheromones.sort((a, b) => a.age - b.age);
            const toRemove = this.pheromones.splice(0, this.pheromones.length - this.maxPheromones);
            this.removePheromonesFromGrid(toRemove);
        }
    }
    
    update(time, delta) {
        // Update pheromone decay
        for (let i = this.pheromones.length - 1; i >= 0; i--) {
            const pheromone = this.pheromones[i];
            pheromone.age += delta;

            // Decay intensity over time (except for danger pheromones)
            if (pheromone.type !== 'danger') {
                pheromone.intensity = pheromone.maxIntensity * Math.exp(-pheromone.age * this.decayRate);
            } // Danger pheromones never decay

            // For food trails, adjust intensity based on trail length (more followers = stronger)
            if (pheromone.type === 'food_trail') {
                const followerBonus = Math.min(pheromone.trailLength * 0.5, 2.0); // Up to 2.0 bonus intensity
                pheromone.intensity = Math.min(pheromone.maxIntensity + followerBonus, 5.0);
            }

            // Remove very weak pheromones (danger pheromones are never removed)
            if (pheromone.type !== 'danger') {
                const removalThreshold = 0.01;
                if (pheromone.intensity < removalThreshold) {
                    this.removePheromoneFromGrid(pheromone);
                    this.pheromones.splice(i, 1);
                }
            }
        }
        
        // Update visual representation
        if (time - this.lastVisualUpdate > this.updateInterval) {
            this.updateVisuals();
            this.lastVisualUpdate = time;
        }
    }
    
    findStrongestPheromone(x, y, radius, type = null) {
        let strongestPheromone = null;
        let strongestIntensity = 0;
        
        // Get nearby grid cells
        const nearbyCells = this.getNearbyGridCells(x, y, radius);
        
        for (const cell of nearbyCells) {
            const pheromones = this.pheromoneGrid.get(cell) || [];
            
            for (const pheromone of pheromones) {
                const distance = Math.sqrt(
                    (pheromone.x - x) ** 2 + (pheromone.y - y) ** 2
                );
                
                if (distance <= radius) {
                    // Check type filter
                    if (type && pheromone.type !== type) continue;
                    
                    // Weight intensity by distance (closer = stronger)
                    const distanceWeight = 1 - (distance / radius);
                    const weightedIntensity = pheromone.intensity * distanceWeight;
                    
                    if (weightedIntensity > strongestIntensity) {
                        strongestIntensity = weightedIntensity;
                        strongestPheromone = pheromone;
                    }
                }
            }
        }
        
        return strongestPheromone;
    }
    
    findPheromonesInRadius(x, y, radius, type = null) {
        const foundPheromones = [];
        const nearbyCells = this.getNearbyGridCells(x, y, radius);
        
        for (const cell of nearbyCells) {
            const pheromones = this.pheromoneGrid.get(cell) || [];
            
            for (const pheromone of pheromones) {
                const distance = Math.sqrt(
                    (pheromone.x - x) ** 2 + (pheromone.y - y) ** 2
                );
                
                if (distance <= radius) {
                    if (type && pheromone.type !== type) continue;
                    foundPheromones.push({
                        pheromone: pheromone,
                        distance: distance
                    });
                }
            }
        }
        
        return foundPheromones.sort((a, b) => a.distance - b.distance);
    }
    
    getPheromoneDensity(x, y, radius, type = null) {
        const nearbyPheromones = this.findPheromonesInRadius(x, y, radius, type);
        let totalIntensity = 0;
        
        for (const { pheromone, distance } of nearbyPheromones) {
            // Weight by distance
            const distanceWeight = 1 - (distance / radius);
            totalIntensity += pheromone.intensity * distanceWeight;
        }
        
        return totalIntensity;
    }
    
    updateVisuals() {
        this.pheromoneGraphics.clear();
        
        // Group pheromones by type for efficient rendering
        const pheromonesByType = {
            'food_trail': [],
            'exploration': [],
            'danger': []
        };
        
        for (const pheromone of this.pheromones) {
            if (pheromonesByType[pheromone.type]) {
                pheromonesByType[pheromone.type].push(pheromone);
            }
        }
        
        // Draw each type with different colors and styles
        this.drawPheromoneType(pheromonesByType['food_trail'], 0x00FF00, 0.6); // Green for food trails (even more visible)
        this.drawPheromoneType(pheromonesByType['exploration'], 0xFFFF00, 0.15); // Yellow for exploration (slightly stronger)
        this.drawPheromoneType(pheromonesByType['danger'], 0xFF0000, 0.6); // Red for danger (much more visible)
    }
    
    drawPheromoneType(pheromones, color, baseAlpha) {
        for (const pheromone of pheromones) {
            const alpha = pheromone.intensity * baseAlpha;
            let size = Math.max(1, pheromone.intensity * 3);

            // For food trails, increase size based on trail length (more followers = bigger visual)
            if (pheromone.type === 'food_trail') {
                size += pheromone.trailLength * 2; // Each follower adds 2 pixels to size
            }

            this.pheromoneGraphics.fillStyle(color, alpha);
            this.pheromoneGraphics.fillCircle(pheromone.x, pheromone.y, size);
        }
    }
    
    getGridKey(x, y) {
        const gridX = Math.floor(x / this.gridSize);
        const gridY = Math.floor(y / this.gridSize);
        return `${gridX},${gridY}`;
    }
    
    getNearbyGridCells(x, y, radius) {
        const cells = [];
        const cellRadius = Math.ceil(radius / this.gridSize);
        const centerX = Math.floor(x / this.gridSize);
        const centerY = Math.floor(y / this.gridSize);
        
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                cells.push(`${centerX + dx},${centerY + dy}`);
            }
        }
        
        return cells;
    }
    
    removePheromoneFromGrid(pheromone) {
        const gridKey = this.getGridKey(pheromone.x, pheromone.y);
        const cellPheromones = this.pheromoneGrid.get(gridKey);
        
        if (cellPheromones) {
            const index = cellPheromones.indexOf(pheromone);
            if (index !== -1) {
                cellPheromones.splice(index, 1);
            }
            
            // Remove empty cells
            if (cellPheromones.length === 0) {
                this.pheromoneGrid.delete(gridKey);
            }
        }
    }
    
    removePheromonesFromGrid(pheromones) {
        for (const pheromone of pheromones) {
            this.removePheromoneFromGrid(pheromone);
        }
    }
    
    clear() {
        this.pheromones = [];
        this.pheromoneGrid.clear();
        this.pheromoneGraphics.clear();
    }
    
    setDecayRate(rate) {
        this.decayRate = Math.max(0.001, Math.min(0.1, rate));
    }
    
    getStats() {
        const stats = {
            total: this.pheromones.length,
            byType: {}
        };
        
        for (const pheromone of this.pheromones) {
            if (!stats.byType[pheromone.type]) {
                stats.byType[pheromone.type] = 0;
            }
            stats.byType[pheromone.type]++;
        }
        
        return stats;
    }
}
