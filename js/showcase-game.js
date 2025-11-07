/**
 * ANT BEHAVIOR SHOWCASE GAME
 * 
 * This is a specialized version of the ant colony simulation designed for
 * focused observation of ant behavior in controlled environments.
 */

// Import the Colony class - this assumes Colony is global from the script inclusion
// If not global, you'd need to import it or include the script before this one

class ShowcaseTerrainSystem {
    constructor(scene, width, height, environmentType = 'mixed') {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.environmentType = environmentType;
        this.terrainGrid = [];
        this.cellSize = 50; // Smaller cells for more detailed control
        this.gridWidth = Math.ceil(width / this.cellSize);
        this.gridHeight = Math.ceil(height / this.cellSize);

        this.initializeTerrain();
        this.createTerrainVisuals();
    }

    initializeTerrain() {
        // Initialize terrain grid based on selected environment type
        for (let x = 0; x < this.gridWidth; x++) {
            this.terrainGrid[x] = [];
            for (let y = 0; y < this.gridHeight; y++) {
                let terrainType;

                if (this.environmentType === 'mixed') {
                    // Use the same logic as main simulation
                    const rand = Math.random();
                    if (rand < 0.4) {
                        terrainType = 'grass';
                    } else if (rand < 0.7) {
                        terrainType = 'dry_soil';
                    } else {
                        terrainType = 'mud';
                    }
                } else {
                    // Set uniform terrain type
                    terrainType = this.environmentType;
                }

                this.terrainGrid[x][y] = {
                    type: terrainType,
                    sprite: null
                };
            }
        }
    }

    createTerrainVisuals() {
        // Create visual representation of terrain
        for (let x = 0; x < this.gridWidth; x++) {
            for (let y = 0; y < this.gridHeight; y++) {
                const terrain = this.terrainGrid[x][y];
                const worldX = x * this.cellSize;
                const worldY = y * this.cellSize;

                let color;
                switch (terrain.type) {
                    case 'grass':
                        color = 0x228B22; // Forest green
                        break;
                    case 'dry_soil':
                        color = 0xDEB887; // Burlywood
                        break;
                    case 'mud':
                        color = 0x8B4513; // Saddle brown
                        break;
                }

                terrain.sprite = this.scene.add.rectangle(
                    worldX + this.cellSize / 2,
                    worldY + this.cellSize / 2,
                    this.cellSize,
                    this.cellSize,
                    color
                );
                terrain.sprite.setDepth(-2);
            }
        }
    }

    getTerrainAt(x, y) {
        const gridX = Math.floor(x / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);

        if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
            return this.terrainGrid[gridX][gridY];
        }

        return null;
    }

    getSpeedModifier(terrainType, isRaining = false) {
        let baseModifier;

        switch (terrainType) {
            case 'grass':
                baseModifier = 0.8;
                break;
            case 'dry_soil':
                baseModifier = 1.0;
                break;
            case 'mud':
                baseModifier = 0.6;
                break;
            default:
                baseModifier = 1.0;
        }

        return baseModifier;
    }

    // Method to clear and recreate terrain with new environment type
    changeEnvironment(newEnvironmentType) {
        // Clear existing terrain visuals
        for (let x = 0; x < this.gridWidth; x++) {
            for (let y = 0; y < this.gridHeight; y++) {
                if (this.terrainGrid[x][y].sprite) {
                    this.terrainGrid[x][y].sprite.destroy();
                }
            }
        }

        // Update environment type and reinitialize
        this.environmentType = newEnvironmentType;
        this.initializeTerrain();
        this.createTerrainVisuals();
    }
}

/**
 * SHOWCASE COLONY - Specialized colony with no automatic spawning
 * This ensures only the exact selected number of ants are present.
 */
class ShowcaseColony extends Colony {
    constructor(scene, x, y) {
        super(scene, x, y);
        // Disable ALL automatic spawning for showcase
        this.spawnTimer = Infinity; // Disable spawn timer
        this.queenReproductionTimer = Infinity; // Disable queen reproduction
        this.reproductionStages = { eggs: 0, larvae: 0, pupae: 0, adults: 0 }; // Clear any reproduction
        this.hasQueen = false; // No queens for spawning
        this.nuptialFlightActive = false; // No nuptial flights
        this.postFlightTimer = 0; // No post-flight logic
        this.initialSpawnDone = false; // Track if initial spawn is complete
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
        
        // NO automatic spawning at all - this is the key difference
        // Skip all spawning logic from parent class
        
        // Update colony visual based on food storage
        this.updateVisuals();
    }
    
    // Override to completely disable reproduction stages spawning
    updateReproductionStages(delta) {
        // Do nothing - no reproduction in showcase
        this.reproductionStages = { eggs: 0, larvae: 0, pupae: 0, adults: 0 };
    }
    
    // Override to prevent any queen-based spawning
    startNuptialFlight() {
        // Do nothing - no nuptial flights in showcase
        this.nuptialFlightActive = false;
    }
    
    // Override to prevent egg laying
    layEggs() {
        // Do nothing - no egg laying in showcase
        this.reproductionStages = { eggs: 0, larvae: 0, pupae: 0, adults: 0 };
    }
    
    // Override spawnAnt to prevent automatic spawning but allow initial spawn
    spawnAnt() {
        // If this is for initial spawning (before showcase starts), allow it
        if (!this.initialSpawnDone) {
            // Use the parent spawnAnt method for initial spawning
            return super.spawnAnt();
        }
        
        // After initial spawn is done, prevent all spawning
        return null;
    }
    
    // Method to mark initial spawning as complete
    completeInitialSpawn() {
        this.initialSpawnDone = true;
    }
    
    // Override evolve to prevent any spawning-related changes
    evolve() {
        // Do nothing - no evolution in showcase that could affect spawning
        this.generation = this.generation; // Keep current generation
    }
}

class AntBehaviorShowcase extends Phaser.Scene {
    constructor() {
        super({ key: 'AntBehaviorShowcase' });

        // Game state
        this.colony = null;
        this.foodManager = null;
        this.pheromoneSystem = null;

        // Showcase parameters
        this.antCount = 5;
        this.puddlesEnabled = true;
        this.foodEnabled = true;
        this.environmentType = 'mixed';

        // Smaller, focused world
        this.worldWidth = 800;
        this.worldHeight = 600;

        // Systems
        this.terrainSystem = null;
        this.puddleSystem = null;
        this.corpses = [];

        // UI elements
        this.selectedAnt = null;
        this.statsUpdateInterval = 500; // Update stats more frequently for showcase

        // Performance tracking
        this.lastStatsUpdate = 0;
    }

    init(data) {
        // Get configuration from global window object
        if (window.showcaseConfig) {
            this.antCount = window.showcaseConfig.antCount;
            this.environmentType = window.showcaseConfig.environment;
            this.puddlesEnabled = window.showcaseConfig.puddlesEnabled;
            this.foodEnabled = window.showcaseConfig.foodEnabled;
        }
    }

    preload() {
        this.load.atlas('ant_sprites', 'assets/sprites/ant_sprites.png', 'assets/sprites/ant_sprites.json');
    }

    create() {
        // Set world bounds for smaller showcase area
        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.cameras.main.setZoom(1.2); // Slightly zoomed in for detailed observation
        this.cameras.main.centerOn(this.worldWidth / 2, this.worldHeight / 2);

        // Initialize systems with showcase parameters
        this.terrainSystem = new ShowcaseTerrainSystem(this, this.worldWidth, this.worldHeight, this.environmentType);
        this.pheromoneSystem = new PheromoneSystem(this);
        this.foodManager = new FoodManager(this);
        this.colony = new ShowcaseColony(this, this.worldWidth / 2, this.worldHeight / 2);

        // Create initial food sources if enabled
        if (this.foodEnabled) {
            this.foodManager.createRandomFoodSources(3, this.worldWidth, this.worldHeight);
        }

        // Create initial puddles if enabled
        if (this.puddlesEnabled) {
            this.puddleSystem = new PuddleSystem(this);
            this.puddleSystem.spawnRandomPuddles(this.worldWidth, this.worldHeight, 2);
        }

        // Spawn initial ants
        this.spawnInitialAnts();

        // Setup UI controls
        this.setupShowcaseControls();
        this.setupAntSelection();

        // Setup input handlers
        this.setupInputHandlers();

        // Add visual effects
        this.addShowcaseEffects();

        console.log('¡Demostración del Comportamiento de Hormigas inicializada!');
    }

    spawnInitialAnts() {
        // Spawn all ants immediately for showcase
        for (let i = 0; i < this.antCount; i++) {
            this.colony.spawnAnt();
        }
        
        // Mark initial spawn as complete - this prevents future spawning
        this.colony.completeInitialSpawn();
    }

    setupShowcaseControls() {
        // Pause button
        const pauseBtn = document.getElementById('showcase-pause-btn');
        pauseBtn.addEventListener('click', () => {
            this.pauseSimulation();
            pauseBtn.textContent = this.scene.isPaused() ? 'Resume' : 'Pause';
        });

        // Toggle puddles button
        const puddlesBtn = document.getElementById('showcase-toggle-puddles');
        puddlesBtn.addEventListener('click', () => {
            this.togglePuddles();
        });

        // Toggle food button
        const foodBtn = document.getElementById('showcase-toggle-food');
        foodBtn.addEventListener('click', () => {
            this.toggleFood();
        });

        // Reset button
        const resetBtn = document.getElementById('showcase-reset-btn');
        resetBtn.addEventListener('click', () => {
            this.resetShowcase();
        });
    }

    setupAntSelection() {
        const followBtn = document.getElementById('showcase-follow-ant-btn');
        if (followBtn) {
            followBtn.addEventListener('click', () => {
                if (this.selectedAnt) {
                    this.selectedAnt.toggleFollowing();
                    followBtn.textContent = this.selectedAnt.isBeingFollowed ? 'Stop Following' : 'Follow Ant';
                }
            });
        }
    }

    setupInputHandlers() {
        // Camera controls for better observation
        this.input.keyboard.on('keydown-SPACE', () => {
            this.pauseSimulation();
        });

        this.input.keyboard.on('keydown-R', () => {
            this.resetShowcase();
        });

        // Arrow keys for camera movement in showcase
        this.input.keyboard.on('keydown-UP', () => {
            this.cameras.main.scrollY -= 50;
        });

        this.input.keyboard.on('keydown-DOWN', () => {
            this.cameras.main.scrollY += 50;
        });

        this.input.keyboard.on('keydown-LEFT', () => {
            this.cameras.main.scrollX -= 50;
        });

        this.input.keyboard.on('keydown-RIGHT', () => {
            this.cameras.main.scrollX += 50;
        });
    }

    addShowcaseEffects() {
        // Add a subtle focus ring around the colony
        const colonyX = this.worldWidth / 2;
        const colonyY = this.worldHeight / 2;
        
        const focusRing = this.add.circle(colonyX, colonyY, 50, 0x4CAF50, 0.1);
        focusRing.setDepth(-1);
        
        // Add subtle pulsing effect
        this.tweens.add({
            targets: focusRing,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.2,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    update(time, delta) {
        // Update all systems with safety checks
        if (this.pheromoneSystem) {
            this.pheromoneSystem.update(time, delta);
        }
        if (this.colony) {
            this.colony.update(time, delta);
        }
        if (this.foodManager) {
            this.foodManager.update();
        }
        
        if (this.puddleSystem) {
            this.puddleSystem.update(time, delta);
        }

        // Update stats display more frequently for showcase
        if (time - this.lastStatsUpdate > this.statsUpdateInterval) {
            this.updateShowcaseStats();
            this.lastStatsUpdate = time;
        }

        // NO colony evolution in showcase - prevent any spawning-related changes
        // Evolution is disabled to maintain exact ant count

        // Emergency measures
        if (this.colony) {
            this.colony.emergencyFoodDistribution();
        }
    }

    updateShowcaseStats() {
        // Safety checks for disabled systems
        if (!this.colony) {
            document.getElementById('showcase-active-ants').textContent = '0';
            document.getElementById('showcase-food-collected').textContent = '0';
            document.getElementById('showcase-total-ants').textContent = '0';
            document.getElementById('showcase-avg-energy').textContent = '0';
            return;
        }

        const colonyStats = this.colony.getStats();
        const foodStats = this.foodManager ? this.foodManager.getStats() : { totalFoodCollected: 0 };

        // Update UI elements
        document.getElementById('showcase-active-ants').textContent = colonyStats.population;
        document.getElementById('showcase-food-collected').textContent = Math.floor(foodStats.totalFoodCollected);
        document.getElementById('showcase-total-ants').textContent = colonyStats.totalAntsBorn;

        // Calculate average energy
        const ants = this.colony.ants.filter(ant => ant.isAlive());
        const avgEnergy = ants.length > 0 ? 
            Math.floor(ants.reduce((sum, ant) => sum + ant.energy, 0) / ants.length) : 0;
        document.getElementById('showcase-avg-energy').textContent = avgEnergy;

        // Update selected ant stats
        if (this.selectedAnt && this.selectedAnt.isAlive()) {
            this.updateSelectedAntStats();
        }
    }

    updateSelectedAntStats() {
        const ant = this.selectedAnt;
        const stats = ant.getStats();
        
        document.getElementById('showcase-ant-id').textContent = `ID: ${stats.id}`;
        document.getElementById('showcase-ant-role').textContent = `Role: ${stats.role}`;
        document.getElementById('showcase-ant-state').textContent = `State: ${ant.state}`;
        document.getElementById('showcase-ant-energy').textContent = `Energy: ${Math.floor(ant.energy)}`;
        document.getElementById('showcase-ant-food').textContent = `Food Carried: ${ant.foodAmount}`;
        
        const healthPercent = Math.floor((ant.energy / ant.maxEnergy) * 100);
        document.getElementById('showcase-ant-health').textContent = `Health: ${healthPercent}%`;
    }

    selectAnt(ant) {
        // Stop following previous ant if any
        if (this.selectedAnt && this.selectedAnt !== ant) {
            this.selectedAnt.stopFollowing();
        }

        this.selectedAnt = ant;
        const antStatsDiv = document.getElementById('showcase-ant-stats');
        antStatsDiv.style.display = 'block';
        
        this.updateSelectedAntStats();
    }

    togglePuddles() {
        this.puddlesEnabled = !this.puddlesEnabled;
        
        if (this.puddlesEnabled) {
            if (!this.puddleSystem) {
                this.puddleSystem = new PuddleSystem(this);
            }
            this.puddleSystem.spawnRandomPuddles(this.worldWidth, this.worldHeight, 2);
            document.getElementById('showcase-toggle-puddles').style.background = '#27ae60';
        } else {
            if (this.puddleSystem) {
                this.puddleSystem.clear();
                this.puddleSystem = null;
            }
            document.getElementById('showcase-toggle-puddles').style.background = '#e74c3c';
        }
    }

    toggleFood() {
        this.foodEnabled = !this.foodEnabled;
        
        if (this.foodEnabled) {
            this.foodManager.createRandomFoodSources(3, this.worldWidth, this.worldHeight);
            document.getElementById('showcase-toggle-food').style.background = '#27ae60';
        } else {
            this.foodManager.clear();
            document.getElementById('showcase-toggle-food').style.background = '#e74c3c';
        }
    }

    pauseSimulation() {
        if (this.scene.isPaused()) {
            this.scene.resume();
            console.log('Demostración reanudada');
        } else {
            this.scene.pause();
            console.log('Demostración pausada');
        }
    }

    resetShowcase() {
        // Resume game if paused
        if (this.scene.isPaused()) {
            this.scene.resume();
        }

        // Clear all systems
        if (this.colony) this.colony.destroy();
        if (this.foodManager) this.foodManager.clear();
        if (this.pheromoneSystem) this.pheromoneSystem.clear();
        if (this.puddleSystem) this.puddleSystem.clear();

        // Reset selected ant
        this.selectedAnt = null;
        document.getElementById('showcase-ant-stats').style.display = 'none';

        // Recreate systems with current settings
        this.pheromoneSystem = new PheromoneSystem(this);
        this.foodManager = new FoodManager(this);
        this.colony = new ShowcaseColony(this, this.worldWidth / 2, this.worldHeight / 2);

        // Spawn new ants after creating colony (initialSpawnDone will be set by spawnInitialAnts)
        this.spawnInitialAnts();

        if (this.foodEnabled) {
            this.foodManager.createRandomFoodSources(3, this.worldWidth, this.worldHeight);
        }

        if (this.puddlesEnabled) {
            this.puddleSystem = new PuddleSystem(this);
            this.puddleSystem.spawnRandomPuddles(this.worldWidth, this.worldHeight, 2);
        }

        // Reset button states
        document.getElementById('showcase-toggle-puddles').style.background = 
            this.puddlesEnabled ? '#27ae60' : '#e74c3c';
        document.getElementById('showcase-toggle-food').style.background = 
            this.foodEnabled ? '#27ae60' : '#e74c3c';

        console.log('¡Demostración reiniciada!');
    }
}

// Global function to change environment type (for potential future use)
window.changeShowcaseEnvironment = function(environmentType) {
    if (window.showcaseGame && window.showcaseGame.scene && window.showcaseGame.scene.scenes[0]) {
        const scene = window.showcaseGame.scene.scenes[0];
        if (scene.terrainSystem) {
            scene.terrainSystem.changeEnvironment(environmentType);
        }
    }
};