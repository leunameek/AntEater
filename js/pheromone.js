class PheromoneSystem {
    constructor(scene) {
        this.scene = scene;
        this.pheromones = [];
        this.decayRate = 0.005; // How fast pheromones fade
        this.maxPheromones = 1000; // Maximum number of pheromone points
        this.gridSize = 20; // Size of pheromone grid cells
        this.pheromoneGrid = new Map(); // Spatial hash for efficient lookup
        
        // Visual representation
        this.pheromoneGraphics = scene.add.graphics();
        this.updateInterval = 100; // Update visuals every 100ms
        this.lastVisualUpdate = 0;
    }
    
    addPheromone(x, y, type, intensity = 1.0) {
        // Create new pheromone
        const pheromone = {
            x: x,
            y: y,
            type: type, // 'food_trail', 'exploration', 'danger'
            intensity: Math.min(intensity, 1.0),
            maxIntensity: intensity,
            age: 0,
            id: Date.now() + Math.random()
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
            
            // Decay intensity over time
            pheromone.intensity = pheromone.maxIntensity * Math.exp(-pheromone.age * this.decayRate);
            
            // Remove very weak pheromones
            if (pheromone.intensity < 0.01) {
                this.removePheromoneFromGrid(pheromone);
                this.pheromones.splice(i, 1);
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
        this.drawPheromoneType(pheromonesByType['food_trail'], 0x00FF00, 0.3); // Green for food trails
        this.drawPheromoneType(pheromonesByType['exploration'], 0xFFFF00, 0.1); // Yellow for exploration
        this.drawPheromoneType(pheromonesByType['danger'], 0xFF0000, 0.2); // Red for danger
    }
    
    drawPheromoneType(pheromones, color, baseAlpha) {
        for (const pheromone of pheromones) {
            const alpha = pheromone.intensity * baseAlpha;
            const size = Math.max(1, pheromone.intensity * 3);
            
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
