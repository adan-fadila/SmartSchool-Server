# New Interpreter System

This is a new interpreter system for the SmartSchool Server that uses an event-driven, observer pattern approach to handle rules, events, and actions.

## Architecture

The system is built around the following key components:

### Core Components

- **Observer Pattern**: Events observe sensor values, and actions observe events
- **Events**: Conditions that are evaluated based on sensor data (e.g., temperature, motion)
- **Actions**: Operations that are executed when events' conditions are met (e.g., turning on lights, controlling AC)
- **Rules**: Connections between events and actions

### Key Features

- **Reusable Components**: Events and actions are reused when possible to avoid duplication
- **Reactive Flow**: Sensor data updates events, which notify actions when conditions are met
- **Extensible Design**: Easy to add new event types and action types

## Usage

### Creating Rules

Rules are created using natural language strings:

```javascript
// Initialize the interpreter
await Interpreter.initialize();

// Create a rule
const rule = Interpreter.createRule('if temperature in living room > 25 then light in living room on');
```

### Processing Sensor Data

The interpreter processes sensor data and updates events accordingly:

```javascript
// Process temperature data
Interpreter.processSensorData({
    type: 'temperature',
    location: 'living room',
    temperature: 26
});

// Process motion data
Interpreter.processSensorData({
    type: 'motion',
    location: 'living room',
    motion: true
});
```

### Managing Rules

Rules can be activated, deactivated, and deleted:

```javascript
// Deactivate a rule
Interpreter.deactivateRule(ruleId);

// Activate a rule
Interpreter.activateRule(ruleId);

// Delete a rule
Interpreter.deleteRule(ruleId);
```

## Supported Events

- **Temperature**: Triggers based on temperature conditions
  - Example: `temperature in living room > 25`
- **Motion**: Triggers based on motion detection
  - Example: `motion in living room detected`
- **Humidity**: Triggers based on humidity conditions
  - Example: `humidity in living room > 60`

## Supported Actions

- **Light**: Controls light devices
  - Example: `light in living room on`
- **AC**: Controls air conditioner devices
  - Example: `ac in bedroom on 23 cool`

## Extending the System

### Adding New Event Types

To add a new event type:

1. Create a new class that extends `BaseEvent`
2. Implement the required methods: `getConditionString()` and `updateWithSensorData()`
3. Register the event type in the parser

### Adding New Action Types

To add a new action type:

1. Create a new class that extends `BaseAction`
2. Implement the required method: `execute()`
3. Register the action type in the parser

## Example

See `example.js` for a complete example of how to use the interpreter. 