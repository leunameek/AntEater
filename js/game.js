class TerrainSystem {
    constructor(scene, width, height) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.terrainGrid = [];
        this.cellSize = 100; // Size of each terrain cell (increased for performance)
        this.gridWidth = Math.ceil(width / this.cellSize);
        this.gridHeight = Math.ceil(height / this.cellSize);

        this.initializeTerrain();
        this.createTerrainVisuals();
    }

    initializeTerrain() {
        // Initialize terrain grid with different types
        for (let x = 0; x < this.gridWidth; x++) {
            this.terrainGrid[x] = [];
            for (let y = 0; y < this.gridHeight; y++) {
                // Randomly assign terrain types with weighted probabilities
                const rand = Math.random();
                let terrainType;

                if (rand < 0.4) {
                    terrainType = 'grass'; // 40% grass
                } else if (rand < 0.7) {
                    terrainType = 'dry_soil'; // 30% dry soil
                } else {
                    terrainType = 'mud'; // 30% mud
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
                terrain.sprite.setDepth(-2); // Behind everything
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
                baseModifier = 0.8; // Slower on grass
                break;
            case 'dry_soil':
                baseModifier = 1.0; // Normal speed on dry soil
                break;
            case 'mud':
                baseModifier = 0.6; // Much slower on mud
                break;
            default:
                baseModifier = 1.0;
        }

        // Rain affects speed
        if (isRaining) {
            baseModifier *= 0.7; // 30% slower in rain
        }

        return baseModifier;
    }
}

class AntColonyGame extends Phaser.Scene {
    constructor() {
        super({ key: 'AntColonyGame' });

        // Game state
        this.colony = null;
        this.foodManager = null;
        this.pheromoneSystem = null;

        // Simulation parameters
        this.antCount = 50;
        this.foodCount = 8; // Increased food count for better spread
        this.pheromoneDecay = 0.005;
        this.simulationSpeed = 1.0;

        // Initial spawning
        this.initialAntsToSpawn = 0;
        this.initialSpawnTimer = 0;
        this.initialSpawnInterval = 2000; // Spawn one ant every 2 seconds


        // Random events
        this.eventTimer = 0;
        this.eventInterval = 30000; // Check for events every 30 seconds
        this.rainActive = false;
        this.rainDuration = 0;

        // Attack state
        this.attackActive = false;
        this.termiteCount = 10;
        this.termites = [];

        // Terrain system
        this.terrainSystem = null;

        // Puddle system
        this.puddleSystem = null;

        // Corpse system
        this.corpses = [];

        // UI elements
        this.uiElements = {};
        this.selectedAnt = null;
        this.gameOverText = null;

        // Performance tracking
        this.lastStatsUpdate = 0;
        this.statsUpdateInterval = 1000; // Update stats every second
    }

    init(data) {
        if (window.initialAntCount) {
            this.antCount = window.initialAntCount;
        }
    }
    
    preload() {
        this.load.atlas('ant_sprites', 'assets/sprites/ant_sprites.png', 'assets/sprites/ant_sprites.json');
    }
    
    create() {
        // Set world bounds to match canvas size initially, but allow expansion
        const canvasWidth = this.cameras.main.width;
        const canvasHeight = this.cameras.main.height;
        const worldWidth = Math.max(canvasWidth * 3, 1800); // At least 3x canvas width for better spread
        const worldHeight = Math.max(canvasHeight * 3, 1350); // At least 3x canvas height for better spread

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // Start with a reasonable zoom to show the world
        this.cameras.main.setZoom(0.8); // Slightly zoomed out to show more area
        this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);

        // Initialize systems
        this.terrainSystem = new TerrainSystem(this, worldWidth, worldHeight);
        this.pheromoneSystem = new PheromoneSystem(this);
        this.foodManager = new FoodManager(this);
        this.puddleSystem = new PuddleSystem(this);
        this.colony = new Colony(this, worldWidth / 2, worldHeight / 2);

        // Create initial food sources
        this.foodManager.createRandomFoodSources(this.foodCount, worldWidth, worldHeight);

        // Create initial puddles
        this.puddleSystem.spawnRandomPuddles(worldWidth, worldHeight, 3);

        // Spawn initial ants
        this.spawnInitialAnts();

        // Setup UI controls
        this.setupUIControls();
        this.setupAntSelection();

        // Setup input handlers
        this.setupInputHandlers();

        // Create stats display
        this.createStatsDisplay();

        // Add some visual effects
        this.addVisualEffects();

        console.log('Ant Colony Simulation initialized!');
    }
    
    spawnInitialAnts() {
        this.initialAntsToSpawn = this.antCount;
    }
    
    setupUIControls() {
        // Pause button
        const pauseBtn = document.getElementById('pause-btn');
        pauseBtn.addEventListener('click', () => {
            this.pauseSimulation();
            pauseBtn.textContent = this.scene.isPaused() ? 'Resume Game' : 'Pause Game';
        });

        // Add random food button
        const addFoodBtn = document.getElementById('add-food-btn');
        addFoodBtn.addEventListener('click', () => {
            this.addRandomFood();
        });

        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        resetBtn.addEventListener('click', () => {
            this.resetSimulation();
        });
    }
    
    setupInputHandlers() {
        // Camera dragging variables
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.cameraStartX = 0;
        this.cameraStartY = 0;

        // Constrain camera to bounds initially
        this.constrainCameraToBounds();

        // Mouse wheel zoom with cursor position focus
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const zoomSpeed = 0.05; // Reduced from 0.1 for smoother zooming
            const minZoom = 0.3; // Allow more zoom out
            const maxZoom = 2.0;

            let newZoom = this.cameras.main.zoom;
            if (deltaY > 0) {
                // Zoom out - gradual zoom out instead of instant fit
                newZoom = Math.max(minZoom, newZoom - zoomSpeed);

                // Calculate zoom to fit entire world
                const canvasWidth = this.cameras.main.width;
                const canvasHeight = this.cameras.main.height;
                const worldWidth = this.physics.world.bounds.width;
                const worldHeight = this.physics.world.bounds.height;

                const zoomX = canvasWidth / worldWidth;
                const zoomY = canvasHeight / worldHeight;
                const fitZoom = Math.min(zoomX, zoomY) * 0.98; // 98% to ensure full coverage

                // Don't go beyond fit zoom, but allow gradual zooming
                newZoom = Math.max(fitZoom, newZoom);

                // Center on world center when zooming out significantly
                if (newZoom <= fitZoom * 1.2) {
                    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);
                }
            } else {
                // Zoom in - center on cursor position
                newZoom = Math.min(maxZoom, newZoom + zoomSpeed);
                const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
                this.cameras.main.centerOn(worldPoint.x, worldPoint.y);
            }

            this.cameras.main.setZoom(newZoom);

            // Constrain camera position after zoom change
            this.constrainCameraToBounds();
        });

        // Middle mouse button or Alt+Left click dragging
        this.input.on('pointerdown', (pointer) => {
            // Check if we're not clicking on UI elements
            const uiPanel = document.getElementById('ui-panel');
            const isClickingUI = uiPanel && uiPanel.contains(pointer.event.target);

            if (!isClickingUI && (pointer.middleButtonDown() || (pointer.leftButtonDown() && this.input.keyboard.checkDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ALT))))) {
                this.isDragging = true;
                this.dragStartX = pointer.x;
                this.dragStartY = pointer.y;
                this.cameraStartX = this.cameras.main.scrollX;
                this.cameraStartY = this.cameras.main.scrollY;
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (this.isDragging) {
                const deltaX = pointer.x - this.dragStartX;
                const deltaY = pointer.y - this.dragStartY;

                // Convert screen delta to world delta based on zoom
                const worldDeltaX = deltaX / this.cameras.main.zoom;
                const worldDeltaY = deltaY / this.cameras.main.zoom;

                const newScrollX = this.cameraStartX - worldDeltaX;
                const newScrollY = this.cameraStartY - worldDeltaY;

                // Allow free movement - remove bounds constraints for better exploration
                this.cameras.main.setScroll(newScrollX, newScrollY);
            }
        });

        this.input.on('pointerup', (pointer) => {
            if (this.isDragging) {
                this.isDragging = false;
            }
        });

        // Keyboard shortcuts
        this.input.keyboard.on('keydown-SPACE', () => {
            this.pauseSimulation();
        });

        this.input.keyboard.on('keydown-R', () => {
            this.resetSimulation();
        });
    }
    
    createStatsDisplay() {
        // Stats are now displayed in the UI panel
    }
    
    addVisualEffects() {
        // Add some background particles
        this.createBackgroundParticles();
        
        // Add day/night cycle effect
        this.createDayNightCycle();
    }
    
    createBackgroundParticles() {
        // Skip particles for now - no textures loaded
        // Can be added later with proper texture loading
    }
    
    createDayNightCycle() {
        // Create a subtle day/night cycle
        this.dayNightOverlay = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0
        );
        this.dayNightOverlay.setScrollFactor(0);
        
        // Animate the overlay
        this.tweens.add({
            targets: this.dayNightOverlay,
            alpha: 0.1,
            duration: 10000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    
    updateRandomEvents(time, delta) {
        // Update active events
        if (this.rainActive) {
            this.rainDuration -= delta;
            if (this.rainDuration <= 0) {
                this.endRain();
            }
        }

        // Check for new events
        this.eventTimer += delta;
        if (this.eventTimer >= this.eventInterval) {
            this.eventTimer = 0;
            this.triggerRandomEvent();
        }
    }

    triggerRandomEvent() {
        const rand = Math.random();

        if (rand < 0.004) { // 0.4% chance - termite attack
            this.startTermiteAttack();
        } else if (rand < 0.104) { // 10% chance - rain
            this.startRain();
        }
        // 89.6% chance - no event
    }

    startRain() {
        if (this.rainActive) return;

        this.rainActive = true;
        this.rainDuration = 10000 + Math.random() * 15000; // 10-25 seconds

        // Create rain effect
        this.createRainEffect();

        console.log('Rain started!');
    }

    endRain() {
        this.rainActive = false;
        if (this.rainOverlay) {
            this.rainOverlay.destroy();
            this.rainOverlay = null;
        }
        console.log('Rain ended!');
    }

    createRainEffect() {
        // Create simple rain effect with graphics
        const { width, height } = this.cameras.main.getBounds();

        // Create rain overlay
        this.rainOverlay = this.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x4169E1,
            0.1
        );
        this.rainOverlay.setScrollFactor(0);
        this.rainOverlay.setDepth(100);
    }

    startTermiteAttack() {
        if (this.attackActive) return;

        this.attackActive = true;
        const { width, height } = this.cameras.main.getBounds();

        // Calculate termite count based on ant population (1 termite per 3 ants, min 3)
        const antCount = this.colony.ants.length;
        this.termiteCount = Math.max(3, Math.floor(antCount / 3));

        // Spawn termites from edges
        for (let i = 0; i < this.termiteCount; i++) {
            let x, y;
            const side = Math.floor(Math.random() * 4);

            switch (side) {
                case 0: // Top
                    x = Math.random() * width;
                    y = -20;
                    break;
                case 1: // Right
                    x = width + 20;
                    y = Math.random() * height;
                    break;
                case 2: // Bottom
                    x = Math.random() * width;
                    y = height + 20;
                    break;
                case 3: // Left
                    x = -20;
                    y = Math.random() * height;
                    break;
            }

            const termite = new Termite(this, x, y);
            this.termites.push(termite);
        }

        console.log(`Termite attack started! ${this.termiteCount} termites spawned.`);
    }

    endAttack() {
        this.attackActive = false;

        // Reset all ant states to normal
        for (const ant of this.colony.ants) {
            if (ant.isAlive()) {
                ant.state = 'exploring';
                ant.target = null;
            }
        }
    }

    update(time, delta) {
        // Gradual initial spawning
        if (this.initialAntsToSpawn > 0) {
            this.initialSpawnTimer += delta;
            if (this.initialSpawnTimer >= this.initialSpawnInterval) {
                this.colony.spawnAnt();
                this.initialAntsToSpawn--;
                this.initialSpawnTimer = 0;
            }
        }

        // Update all systems
        this.pheromoneSystem.update(time, delta);
        this.colony.update(time, delta);
        this.foodManager.update();
        this.puddleSystem.update(time, delta);

        // Update termites
        for (let i = this.termites.length - 1; i >= 0; i--) {
            const termite = this.termites[i];
            if (termite.isAlive()) {
                termite.update(time, delta);
            } else {
                this.termites.splice(i, 1);
            }
        }

        // Check if attack is over (all termites defeated)
        if (this.attackActive && this.termites.length === 0) {
            this.endAttack();
        }


        // Assign food targets to ants (this is now handled in individual ant updateState)
        // this.colony.assignFoodTargets(this.foodManager);

        // Update stats display
        if (time - this.lastStatsUpdate > this.statsUpdateInterval) {
            this.updateStatsDisplay();
            this.lastStatsUpdate = time;
        }

        // Handle colony evolution
        if (this.colony.foodStorage > 200 && Math.random() < 0.001) {
            this.colony.evolve();
        }

        // Emergency measures
        this.colony.emergencyFoodDistribution();

        // Handle random events
        this.updateRandomEvents(time, delta);
    }







    
    updateStatsDisplay() {
        const colonyStats = this.colony.getStats();
        const foodStats = this.foodManager.getStats();
        const pheromoneStats = this.pheromoneSystem.getStats();

        // Update UI elements
        document.getElementById('food-collected').textContent = Math.floor(foodStats.totalFoodCollected);
        document.getElementById('active-ants').textContent = colonyStats.population;
        document.getElementById('pheromone-intensity').textContent = pheromoneStats.total;
        document.getElementById('population').textContent = `${colonyStats.population}/${colonyStats.maxPopulation}`;
        document.getElementById('food-storage').textContent = Math.floor(colonyStats.foodStorage);
        document.getElementById('food-sources').textContent = `${foodStats.activeSources}/${foodStats.totalSources}`;
        document.getElementById('total-ants').textContent = colonyStats.totalAntsBorn;
        document.getElementById('generation').textContent = colonyStats.generation;
        document.getElementById('efficiency').textContent = `${(colonyStats.efficiency * 100).toFixed(1)}%`;

        // Update reproduction display
        this.updateReproductionDisplay(colonyStats);
    }

    updateReproductionDisplay(colonyStats) {
        const reproductionInfo = document.getElementById('reproduction-info');
        const eggsCount = document.getElementById('eggs-count');
        const larvaeCount = document.getElementById('larvae-count');
        const pupaeCount = document.getElementById('pupae-count');
        const nuptialFlightStatus = document.getElementById('nuptial-flight-status');

        const stages = colonyStats.reproductionStages;
        const hasReproduction = stages.eggs > 0 || stages.larvae > 0 || stages.pupae > 0 || colonyStats.nuptialFlightActive;

        if (hasReproduction) {
            reproductionInfo.style.display = 'block';
            eggsCount.textContent = stages.eggs;
            larvaeCount.textContent = stages.larvae;
            pupaeCount.textContent = stages.pupae;

            if (colonyStats.nuptialFlightActive) {
                nuptialFlightStatus.style.display = 'block';
            } else {
                nuptialFlightStatus.style.display = 'none';
            }
        } else {
            reproductionInfo.style.display = 'none';
        }
    }
    
    resetSimulation() {
        // Resume game if paused
        if (this.scene.isPaused()) {
            this.scene.resume();
        }

        // Clear ant selection
        this.clearSelection();

        // Clear all systems
        if (this.colony) this.colony.destroy();
        if (this.foodManager) this.foodManager.clear();
        if (this.pheromoneSystem) this.pheromoneSystem.clear();
        if (this.puddleSystem) this.puddleSystem.clear();

        // Clear all remaining ant ID texts that might be lingering
        this.clearAllAntTexts();

        // Clear termites
        for (const termite of this.termites) {
            if (termite.sprite) {
                termite.sprite.destroy();
            }
        }
        this.termites = [];
        this.attackActive = false;


        // Reset buttons
        const addFoodBtn = document.getElementById('add-food-btn');
        if (addFoodBtn) {
            addFoodBtn.disabled = false;
        }

        // Recreate systems
        const { width, height } = this.cameras.main.getBounds(); // Use world bounds
        this.colony = new Colony(this, width / 2, height / 2);
        this.foodManager.createRandomFoodSources(this.foodCount, width, height);
        this.puddleSystem.spawnRandomPuddles(width, height, 3);

        // Spawn new ants
        this.spawnInitialAnts();

        console.log('Simulation reset!');
    }

    clearAllAntTexts() {
        // Find and destroy any lingering ant ID texts
        const antTexts = this.children.list.filter(child => 
            child.type === 'Text' && 
            child.fontFamily === 'Jersey 10' && 
            child.fontSize === '12px'
        );
        
        for (const text of antTexts) {
            text.destroy();
        }
    }
    
    pauseSimulation() {
        if (this.scene.isPaused()) {
            this.scene.resume();
            console.log('Simulation resumed');
        } else {
            this.scene.pause();
            console.log('Simulation paused');
        }
    }
    
    // Method to add obstacles
    addObstacle(x, y, width, height) {
        const obstacle = this.add.rectangle(x, y, width, height, 0x8B4513);
        this.physics.add.existing(obstacle, true); // true = static body
        
        // Make ants avoid obstacles
        this.physics.add.collider(this.colony.ants.map(ant => ant.sprite), obstacle);
    }
    
    // Method to create a more complex environment
    createEnvironment() {
        const { width, height } = this.cameras.main;

        // Add some random obstacles
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const w = 20 + Math.random() * 40;
            const h = 20 + Math.random() * 40;
            this.addObstacle(x, y, w, h);
        }
    }

    // Method to add random food sources
    addRandomFood() {
        const { width, height } = this.cameras.main.getBounds(); // Use world bounds instead of camera bounds
        const numSources = Math.floor(Math.random() * 3) + 1; // 1-3 sources

        for (let i = 0; i < numSources; i++) {
            const x = Math.random() * (width - 100) + 50;
            const y = Math.random() * (height - 100) + 50;
            const amount = Math.floor(Math.random() * 100) + 50; // 50-150 food
            this.foodManager.createFoodSource(x, y, amount);
        }
    }

    // Method to constrain camera within world bounds
    constrainCameraToBounds() {
        const worldWidth = this.physics.world.bounds.width;
        const worldHeight = this.physics.world.bounds.height;
        const cameraWidth = this.cameras.main.width / this.cameras.main.zoom;
        const cameraHeight = this.cameras.main.height / this.cameras.main.zoom;

        const constrainedX = Phaser.Math.Clamp(this.cameras.main.scrollX, 0, worldWidth - cameraWidth);
        const constrainedY = Phaser.Math.Clamp(this.cameras.main.scrollY, 0, worldHeight - cameraHeight);

        this.cameras.main.setScroll(constrainedX, constrainedY);
    }




    selectAnt(ant) {
        // Stop following previous ant if any
        if (this.selectedAnt && this.selectedAnt !== ant) {
            this.selectedAnt.stopFollowing();
        }

        this.selectedAnt = ant;
        const stats = ant.getStats();
        const antStatsDiv = document.getElementById('ant-stats');
        const idEl = document.getElementById('ant-id');
        const roleEl = document.getElementById('ant-role');
        const healthEl = document.getElementById('ant-health');
        const statusEl = document.getElementById('ant-status');
        const energyEl = document.getElementById('ant-energy');
        const foodCollectedEl = document.getElementById('ant-food-collected');
        const fedBroodEl = document.getElementById('ant-fed-brood');
        const lifespanEl = document.getElementById('ant-lifespan');
        const corpsesCollectedEl = document.getElementById('ant-corpses-collected');
        const followBtn = document.getElementById('follow-ant-btn');

        idEl.textContent = `ID: ${stats.id}`;
        roleEl.textContent = `Role: ${stats.role}`;
        healthEl.textContent = `Health: ${stats.health}`;
        statusEl.textContent = `Status: ${stats.status}`;
        energyEl.textContent = `Energy: ${stats.energy}`;
        foodCollectedEl.textContent = `Food Collected: ${stats.foodCollected}`;
        fedBroodEl.textContent = `Fed Brood: ${stats.fedBrood}`;
        lifespanEl.textContent = `Lifespan: ${stats.lifespan}`;
        corpsesCollectedEl.textContent = `Corpses Collected: ${stats.corpsesCollected}`;

        // Update follow button text
        followBtn.textContent = ant.isBeingFollowed ? 'Stop Following' : 'Follow Ant';

        antStatsDiv.style.display = 'block';
    }

    clearSelection() {
        // Stop following the ant if it was being followed
        if (this.selectedAnt && this.selectedAnt.isBeingFollowed) {
            this.selectedAnt.stopFollowing();
        }

        this.selectedAnt = null;
        document.getElementById('ant-stats').style.display = 'none';
    }

    setupAntSelection() {
        const clearBtn = document.getElementById('clear-selection');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearSelection();
            });
        }

        const followBtn = document.getElementById('follow-ant-btn');
        if (followBtn) {
            followBtn.addEventListener('click', () => {
                if (this.selectedAnt) {
                    this.selectedAnt.toggleFollowing();
                    followBtn.textContent = this.selectedAnt.isBeingFollowed ? 'Stop Following' : 'Follow Ant';
                }
            });
        }
    }
}

// Game scene class - initialization handled in index.html

// Console commands are now defined in index.html after game initialization
