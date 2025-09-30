# Ant Colony Simulation

A fascinating ant colony simulation built with Phaser.js that demonstrates emergent behavior, pheromone trails, and collective intelligence.

## Features

### 🐜 Ant Behavior
- **Worker Ants**: Collect food and return to colony
- **Scout Ants**: Explore the environment and find new food sources
- **Pheromone Trails**: Ants leave chemical trails for pathfinding
- **Energy System**: Ants consume energy and can die if exhausted
- **Food Collection**: Ants can carry food back to the colony

### 🌍 Environment
- **Food Sources**: Randomly placed food sources that deplete over time
- **Pheromone System**: Visual representation of ant trails
- **Dynamic Spawning**: Colony grows based on food availability
- **Obstacles**: Interactive environment with barriers

### 🎮 Interactive Controls
- **Real-time Parameters**: Adjust ant count, food sources, and simulation speed
- **Mouse Interaction**: Click to add food, right-click to add pheromones
- **Keyboard Shortcuts**: Space to pause, R to reset, F to add food
- **Visual Feedback**: Color-coded ants based on their current state

## Getting Started

### Prerequisites
- Node.js (for development server)
- Modern web browser

### Installation

1. Clone or download the project
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:8080`

### Alternative Setup
If you don't want to use npm, simply open `index.html` in a modern web browser.

## How to Play

### Basic Controls
- **Left Click**: Add a new food source at cursor position
- **Right Click**: Add pheromone trail at cursor position
- **Space**: Pause/resume simulation
- **R**: Reset the entire simulation
- **F**: Add food source at cursor position

### UI Controls
- **Ant Count**: Adjust the number of ants in the simulation (10-200)
- **Food Sources**: Control the number of food sources (1-10)
- **Pheromone Decay**: Adjust how quickly pheromone trails fade
- **Simulation Speed**: Control the speed of the simulation (0.5x - 3x)

### Understanding the Simulation

#### Ant States
- **Brown**: Exploring the environment
- **Orange**: Seeking food sources
- **Green**: Carrying food back to colony
- **Dark Brown**: Returning home

#### Pheromone Trails
- **Green Trails**: Strong food trails left by ants carrying food
- **Yellow Trails**: Weak exploration trails
- **Red Trails**: Danger signals (if implemented)

#### Colony Health
- **Green Colony**: Well-fed with plenty of food
- **Gold Colony**: Moderate food supply
- **Orange Colony**: Low food supply
- **Red Colony**: Starving colony

## Technical Details

### Architecture
- **Phaser.js**: Game engine for rendering and physics
- **Modular Design**: Separate classes for Ant, Colony, Food, and Pheromone systems
- **Spatial Hashing**: Efficient pheromone lookup using grid-based system
- **State Machine**: Ants use state-based behavior system

### Key Classes
- `Ant`: Individual ant behavior and movement
- `Colony`: Manages ant population and food storage
- `FoodManager`: Handles food sources and collection
- `PheromoneSystem`: Manages pheromone trails and decay
- `AntColonyGame`: Main game scene and coordination

### Performance Features
- **Spatial Optimization**: Pheromones use grid-based lookup
- **Object Pooling**: Efficient memory management
- **Configurable Limits**: Prevents memory overflow
- **Visual Culling**: Only renders visible elements

## Customization

### Adding New Ant Types
Extend the `Ant` class and modify the `Colony` class to spawn different ant types:

```javascript
class ScoutAnt extends Ant {
    constructor(scene, x, y, colony) {
        super(scene, x, y, colony);
        this.antType = 'scout';
        this.explorationRadius = 400; // Larger exploration radius
    }
}
```

### Modifying Behavior
Adjust parameters in the `Ant` class:
- `speed`: Movement speed
- `energy`: Energy consumption rate
- `pheromoneDropInterval`: How often ants drop pheromones
- `explorationRadius`: How far ants explore

### Adding New Features
- **Predators**: Add creatures that hunt ants
- **Weather**: Environmental effects on ant behavior
- **Multiple Colonies**: Competing ant colonies
- **Genetic Algorithm**: Evolution of ant behavior

## Browser Console Commands

Open the browser console (F12) and try these commands:

```javascript
// Add food at specific coordinates
addFood(400, 300, 150);

// Add obstacle
addObstacle(200, 200, 50, 50);

// Access game instance
game.scene.scenes[0].colony.getStats();
```

## Performance Tips

- Start with fewer ants (50-100) for better performance
- Reduce pheromone decay rate for more complex trails
- Use lower simulation speeds for detailed observation
- Close other browser tabs to free up memory

## Troubleshooting

### Common Issues
1. **Simulation runs slowly**: Reduce ant count or increase pheromone decay
2. **Ants get stuck**: Add more food sources or reset simulation
3. **Memory issues**: Lower maximum pheromone count in PheromoneSystem

### Browser Compatibility
- Chrome/Chromium: Full support
- Firefox: Full support
- Safari: Full support
- Edge: Full support

## Future Enhancements

- [ ] Multiple ant species with different behaviors
- [ ] Seasonal changes affecting food availability
- [ ] Ant wars between competing colonies
- [ ] Genetic algorithm for ant behavior evolution
- [ ] 3D visualization
- [ ] Save/load simulation states
- [ ] Statistical analysis tools
- [ ] VR support

## Contributing

Feel free to fork this project and submit pull requests for new features or improvements!

## License

MIT License - feel free to use this project for educational or commercial purposes.

## Acknowledgments

- Inspired by real ant colony behavior research
- Built with [Phaser.js](https://phaser.io/) game engine
- Pheromone system based on ant communication studies
