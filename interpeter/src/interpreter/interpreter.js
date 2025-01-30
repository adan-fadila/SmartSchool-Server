const { CommandFactory } = require('../factories/commandFactory');
const { debug, Console } = require('console');
const RoomDevice = require("../../../models/RoomDevice");
const Rule = require("../../../models/Rule");
const Activity = require("../../../models/Activity");
const { getAllRoomIds, getRoomByName, getAllRoomNames } = require('../../../services/rooms.service');
const { getCurrentActivity, getCurrentSeason } = require('../../../services/time.service');
const { getDevicesByRoomId } = require("../../../services/devices.service");
const { tokenize } = require('../lexer/lexer');
const { parse } = require('../parser/parser');
const NodeCache = require('node-cache');
const { log } = require('util');
const cache = new NodeCache({ stdTTL: 300 }); // Cache for 5 minutes
const Room = require("../../../models/Room");

// Debounce mechanism
let debounceTimeout = null;

function debounce(fn, delay) {
    return function (...args) {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => fn(...args), delay);
    };
}

function convertOperators(operators) {
    const operatorMap = {
        'and': '&&',
        'or': '||'
    };

    return operators.map(op => operatorMap[op.toLowerCase()] || op);
}

function evaluateLogic(results, operators) {
    if (results.length - 1 !== operators.length) {
        throw new Error("The number of operators should be one less than the number of results.");
    }

    if (operators.length === 0) {
        return results[0];
    }

    let currentValue = results[0];

    for (let i = 0; i < operators.length; i++) {
        const nextValue = results[i + 1];
        switch (operators[i]) {
            case '&&':
                currentValue = currentValue && nextValue;
                break;
            case '||':
                currentValue = currentValue || nextValue;
                break;
            default:
                console.error(`Unsupported operator: ${operators[i]}`);
                return false;
        }
    }
    return currentValue;
}

function getContextType(sentence, context) {
    const activities = ['studying', 'cooking', 'eating', 'playing', 'watching_tv', 'sleeping', 'outside'];
    const seasons = ['spring', 'summer', 'fall', 'winter'];
    const words = sentence.toLowerCase().split(/\s+/);

    if (/\bnot in\b/.test(sentence)) {
        return context['detection'] === false;
    }

    if (/\bin\b/.test(sentence) && !/\bnot in\b/.test(sentence)) {
        return context['detection'] === true;
    }

    for (const word of words) {
        if (activities.includes(word)) {
            return context['activity'].toLowerCase() === word.toLowerCase();
        } else if (seasons.includes(word)) {
            return context['season'].toLowerCase() === word.toLowerCase();
        }
    }

    return null;
}
function evaluateConditionTemp(parsed, context) {
  const structuredVariablePattern = /\b(in room|detection|temperature|humidity|activity|season|hour)\b/gi;
  const operatorPattern = /\b(is above|is below|is equal to|is above or equal to|is below or equal to|is|not)\b/gi;
  const valuePattern = /\b(\d+|ON|OFF|True|False|true|false|spring|summer|fall|winter|studying|cooking|eating|playing|watching_tv|sleeping|night|evening)\b/gi;

  let results = [];
  parsed.conditions.forEach(condition => {
      console.log("Evaluating condition:", condition);
      
      // Extracting variable, operator, and value using RegExp
      let variableMatch = condition.match(structuredVariablePattern);
      let operatorMatch = condition.match(operatorPattern);
      let valueMatch = condition.match(valuePattern);

      if (!variableMatch || !operatorMatch || !valueMatch) {
          console.error("Invalid condition format:", condition);
          results.push(false);
          return;
      }

      let variable = variableMatch[0].toLowerCase();
      let operator = operatorMatch[0].toLowerCase();
      let conditionValue = valueMatch[0].toLowerCase();
      let contextValue = context[variable];
    
      if (contextValue === undefined) {
          console.error("Context value is undefined for variable:", variable);
          results.push(false);
          return;
      }

      // Handling different data types
      if (conditionValue === "true" || conditionValue === "false") {
          conditionValue = conditionValue === "true";
          contextValue = contextValue === "true" || contextValue === "1";
      } else if (!isNaN(conditionValue)) {
          conditionValue = parseFloat(conditionValue);
          contextValue = parseFloat(contextValue);
      } else {
          conditionValue = conditionValue.toString();
          contextValue = contextValue.toString();
      }

      // Evaluate the condition
      let result = false;
      switch (operator) {
          case 'is above':
              result = contextValue > conditionValue;
              break;
          case 'is below':
              result = contextValue < conditionValue;
              break;
          case 'is equal to':
          case 'is':
              result = contextValue === conditionValue;
              break;
          case 'is above or equal to':
              result = contextValue >= conditionValue;
              break;
          case 'is below or equal to':
              result = contextValue <= conditionValue;
              break;
          case 'in':
              if (typeof contextValue === 'string' || Array.isArray(contextValue)) {
                  result = contextValue.includes(conditionValue);
              } else {
                  console.error("Cannot use 'in' operator on non-string/array context value:", contextValue);
                  result = false;
              }
              break;
          case 'not':
              if (typeof contextValue === 'string' || Array.isArray(contextValue)) {
                  result = !contextValue.includes(conditionValue);
              } else {
                  console.error("Cannot use 'not' operator on non-string/array context value:", contextValue);
                  result = false;
              }
              break;
          default:
              console.error("Unsupported operator:", operator);
              result = false;
              break;
      }
      
      console.log(`Condition: ${condition}, Context Value: ${contextValue}, Condition Value: ${conditionValue}, Result: ${result}`);
      results.push(result);
  });

  return results;
}

function getContextTypeCAll(sentence, context) {
    const seasons = ['spring', 'summer', 'fall', 'winter'];
    const words = sentence.toLowerCase().split(/\s+/);

    if (/\bend\b/.test(sentence)) {
        return context['detection'] === false;
    }

    if (/\bstart\b/.test(sentence) && !/\bend\b/.test(sentence)) {
        return context['detection'] === true;
    }

    for (const word of words) {
        if (seasons.includes(word)) {
            return context['season'].toLowerCase() === word.toLowerCase();
        }
    }

    return null;
}
function evaluateConditionCalendar(parsed, context) {
    const structuredVariablePattern = /\b(in room|detection|temperature|activity|season)\b/gi;
    const operatorPattern = /\b(is above|is below|is equal to|is above or equal to|is below or equal to|is|in|not|start|end)\b/gi;
    const valuePattern = /\b(\d+|ON|OFF|True|False|true|false|spring|summer|fall|winter|studying|cooking|eating|playing|watching_tv|sleeping|room)\b/gi;

    let results = [], result = null;
    parsed.conditions.forEach(condition => {
        result = getContextTypeCAll(condition, context);
        if (result !== null) {
            results.push(result);
        } else {
            let variableMatch = condition.match(structuredVariablePattern);
            let operatorMatch = condition.match(operatorPattern);
            let valueMatch = condition.match(valuePattern);

            if (!variableMatch || !operatorMatch || !valueMatch) {
                console.error("Invalid condition format:", condition);
                results.push(false);
                return;
            }

            let variable = variableMatch[0].toLowerCase();
            let operator = operatorMatch[0].toLowerCase();
            let conditionValue = valueMatch[0].toLowerCase();
            let contextValue = context[variable];

            // console.log("Variable:", variable);
            // console.log("Operator:", operator);
            // console.log("Condition Value:", conditionValue);
            // console.log("Context Value:", contextValue);

            if (contextValue === undefined) {
                console.error("Context value is undefined for variable:", variable);
                results.push(false);
                return;
            }

            if (conditionValue === "true" || conditionValue === "false") {
                conditionValue = (conditionValue === "true");
            }

            let result = false;
            switch (operator) {
                case 'is above':
                    result = parseFloat(contextValue) > parseFloat(conditionValue);
                    break;
                case 'is below':
                    result = parseFloat(contextValue) < parseFloat(conditionValue);
                    break;
                case 'is equal to':
                    result = contextValue.toString() === conditionValue;
                    break;
                case 'is':
                    result = contextValue.toString() === conditionValue;
                    break;
                case 'in':
                    if (typeof contextValue === 'string' || Array.isArray(contextValue)) {
                        result = contextValue.includes(conditionValue);
                    } else {
                        console.error("Cannot use 'in' operator on non-string/array context value:", contextValue);
                        result = false;
                    }
                    break;
                case 'not':
                    if (typeof contextValue === 'string' || Array.isArray(contextValue)) {
                        result = !contextValue.includes(conditionValue);
                    } else {
                        console.error("Cannot use 'not' operator on non-string/array context value:", contextValue);
                        result = false;
                    }
                    break;
                default:
                    console.error("Unsupported operator:", operator);
                    result = false;
                    break;
            }
            results.push(result);
        }
    });

    console.log(results);
    return results;
}

  
function evaluateCondition(parsed, context) {
  const structuredVariablePattern = /\b(in room|detection|temperature|activity|season)\b/gi;
  const operatorPattern = /\b(is above|is below|is equal to|is above or equal to|is below or equal to|is|in|not)\b/gi;
  const valuePattern = /\b(\d+|ON|OFF|True|False|true|false|spring|summer|fall|winter|studying|cooking|eating|playing|watching_tv|sleeping|room)\b/gi;

  let results = [], result = null;
  parsed.conditions.forEach(condition => {
      result = getContextType(condition, context);
      if (result !== null) {
          results.push(result);
          return;
      } else {
          let variableMatch = condition.match(structuredVariablePattern);
          let operatorMatch = condition.match(operatorPattern);
          let valueMatch = condition.match(valuePattern);

          if (!variableMatch || !operatorMatch || !valueMatch) {
              console.error("Invalid condition format:", condition);
              results.push(false);
              return;
          }

          let variable = variableMatch[0].toLowerCase();
          let operator = operatorMatch[0].toLowerCase();
          let conditionValue = valueMatch[0].toLowerCase();
          let contextValue = context[variable];

        //   console.log("Variable:", variable);
        //   console.log("Operator:", operator);
        //   console.log("Condition Value:", conditionValue);
        //   console.log("Context Value:", contextValue);

          if (contextValue === undefined) {
              console.error("Context value is undefined for variable:", variable);
              results.push(false);
              return;
          }

          if (conditionValue === "true | True" || conditionValue === "false | False") {
              Boolean(conditionValue);
          }

          let result = false;
          switch (operator) {
              case 'is above':
                  result = parseFloat(contextValue) > parseFloat(conditionValue);
                  break;
              case 'is below':
                  result = parseFloat(contextValue) < parseFloat(conditionValue);
                  break;
              case 'is equal to':
                  result = contextValue.toString() === conditionValue;
                  break;
              case 'is':
                  result = contextValue.toString() === conditionValue;
                  break;
              case 'in':
                  if (typeof contextValue === 'string' || Array.isArray(contextValue)) {
                      result = contextValue.includes(conditionValue);
                  } else {
                      console.error("Cannot use 'in' operator on non-string/array context value:", contextValue);
                      result = false;
                  }
                  break;
              case 'not':
                  if (typeof contextValue === 'string' || Array.isArray(contextValue)) {
                      result = !contextValue.includes(conditionValue);
                  } else {
                      console.error("Cannot use 'not' operator on non-string/array context value:", contextValue);
                      result = false;
                  }
                  break;
              default:
                  console.error("Unsupported operator:", operator);
                  result = false;
                  break;
          }
          results.push(result);
      }
  });

  return results;
}


async function GetRoomNameFromDatabase(parsed) {
    const cachedRoomNames = cache.get('roomNames');
    let roomNames;
    if (cachedRoomNames) {
        roomNames = cachedRoomNames;
    } else {
        roomNames = await getAllRoomNames();
        cache.set('roomNames', roomNames);
    }

    const normalizedRoomNames = roomNames.map(name => name.toLowerCase().trim());
    const roomNamesPatternString = normalizedRoomNames.join('|');
    const roomNamesPattern = new RegExp(`\\b(${roomNamesPatternString})\\b`, 'i');
    const normalizedParsed = parsed.toLowerCase().trim();
    const roomNameMatch = normalizedParsed.match(roomNamesPattern);

    if (roomNameMatch && roomNameMatch[0]) {
        const matchedName = roomNameMatch[0].trim();
        const roomName = roomNames.find(name => name.toLowerCase() === matchedName);
        if (roomName) {
            const roomDetails = await getRoomByName(roomName);
            return { roomName, roomDetails };
        }
    }

    return  { roomName: "", roomDetails: null };
}

// Context preparation functions
async function prepareBaseContext(data) {
    try {
        const roomName = data.roomName?.trim().toLowerCase() || '';
        return {
            room_Name: roomName,
            roomid: data.roomId,
            space_id: data.spaceId,
        };
    } catch (error) {
        console.error('Error preparing base context:', error);
        throw new Error('Failed to prepare base context');
    }
}

async function prepareEnvironmentalContext(data) {
    try {
        const baseContext = await prepareBaseContext(data);
        const temperatureStr = String(data.temperature);
        const humidityStr = String(data.humidity);
        
        return {
            ...baseContext,
            temperature: parseInt(temperatureStr.split(' ')[0], 10),
            humidity: parseInt(humidityStr.split(' ')[0], 10),
        };
    } catch (error) {
        console.error('Error preparing environmental context:', error);
        throw new Error('Failed to prepare environmental context');
    }
}

async function prepareEventContext(data, currentSeason) {
    try {
        const baseContext = await prepareBaseContext(data);
        const parsedState = data.state === 'on';
        
        return {
            ...baseContext,
            detection: parsedState,
            season: currentSeason,
            control: 'manual',
        };
    } catch (error) {
        console.error('Error preparing event context:', error);
        throw new Error('Failed to prepare event context');
    }
}

async function prepareActivityContext(data, Context, currentActivity, currentSeason) {
    try {
        const baseContext = await prepareBaseContext(data);
        
        return {
            ...baseContext,
            detection: data.motionState,
            activity: Context.activity || currentActivity,
            season: currentSeason,
        };
    } catch (error) {
        console.error('Error preparing activity context:', error);
        throw new Error('Failed to prepare activity context');
    }
}

// Condition extraction function
function extractMainCondition(condition) {
    try {
        const regex = /(\w+)(?: in | not in | is | start | end)/;
        const match = condition.match(regex);
        return match ? match[1] : null;
    } catch (error) {
        console.error('Error extracting main condition:', error);
        throw new Error('Failed to extract main condition');
    }
}

// Room and device fetching functions
async function fetchRoomDetails(roomId) {
    try {
        const room = await Room.findOne({ id: roomId });
        if (!room) {
            throw new Error(`Room not found with ID: ${roomId}`);
        }
        const { name: roomName, ...roomDetails } = room._doc;
        return { roomName, roomDetails };
    } catch (error) {
        console.error('Error fetching room details:', error);
        throw new Error('Failed to fetch room details');
    }
}

async function fetchRoomDevices(roomId) {
    try {
        const roomDevicesResult = await getDevicesByRoomId(roomId);
        if (roomDevicesResult.statusCode !== 200) {
            throw new Error(roomDevicesResult.message);
        }
        return roomDevicesResult;
    } catch (error) {
        console.error('Error fetching room devices:', error);
        throw new Error('Failed to fetch room devices');
    }
}

// Condition evaluation function
async function evaluateConditions(parsed, context, mainContext) {
    try {
        let evaluationResult;
        
        if (['temperature', 'humidity', 'hour'].includes(mainContext)) {
            evaluationResult = evaluateConditionTemp(parsed, context);
        } else if (['party', 'weekend', 'lecture', 'holiday'].includes(mainContext)) {
            evaluationResult = evaluateConditionCalendar(parsed, context);
        } else {
            evaluationResult = evaluateCondition(parsed, context);
        }
        
        const convertedOperators = convertOperators(parsed.specialOperators.condition_operators);
        return evaluateLogic(evaluationResult, convertedOperators);
    } catch (error) {
        console.error('Error evaluating conditions:', error);
        throw new Error('Failed to evaluate conditions');
    }
}

// Action execution function
async function executeActions(actions, roomDetails, roomDevicesResult, data, roomName, res) {
    try {
        for (const action of actions) {
            const commandExecuted = await CommandFactory.createCommand(
                action,
                roomDetails.id,
                roomDevicesResult.data,
                data,
                roomName,
                data,
                res
            );
            console.log(commandExecuted ? "Command was executed successfully." : 'Action could not be executed:', action);
        }
    } catch (error) {
        console.error('Error executing actions:', error);
        throw new Error('Failed to execute actions');
    }
}

// Main process function
async function processData(parsed, data, res, Context) {
    try {
        // Validate input
        if (!parsed?.conditions?.length) {
            throw new Error("Parsed rule is undefined or has no conditions");
        }

        // Get current activity and season
        const currentActivity = await getCurrentActivity();
        const currentSeason = await getCurrentSeason();

        // Extract main condition and prepare context
        const mainContext = extractMainCondition(parsed.conditions[0]);
        let context;

        // Prepare appropriate context based on main condition
        if (['temperature', 'humidity', 'hour'].includes(mainContext)) {
            context = await prepareEnvironmentalContext(data);
        } else if (['party', 'weekend', 'lecture', 'holiday'].includes(mainContext)) {
            context = await prepareEventContext(data, currentSeason);
        } else {
            context = await prepareActivityContext(data, Context, currentActivity, currentSeason);
        }

        // Fetch room details and devices
        const { roomName, roomDetails } = await fetchRoomDetails(data.roomId);
        const roomDevicesResult = await fetchRoomDevices(roomDetails.id);

        // Evaluate conditions
        const result = await evaluateConditions(parsed, context, mainContext);

        // Execute actions if conditions are met and room names match
        if (result && context.room_Name === roomName.toLowerCase()) {
            await executeActions(parsed.actions, roomDetails, roomDevicesResult, data, context.room_Name, res);
        } else {
            console.log("Conditions not met or room name mismatch. No actions executed.");
        }
    } catch (error) {
        console.error('Error in processData:', error);
        throw error;
    }
}



function escapeRegex(text) {
    return text.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
}

async function interpretRuleByName(Condition, data, res, Context, alreadyTried = false) {
    try {
        // console.log(Condition);
        // console.log(data.spaceId);
        const regex = new RegExp(escapeRegex(Condition), 'i');

        let mainCondition;
        if (Condition.includes(' in ')) {
            mainCondition = Condition.split(' in ')[0]; // e.g., "temperature"
        } else if (Condition.includes(' not in ')) {
            mainCondition = Condition.split(' not in ')[0]; // e.g., "temperature"
        } else {
            mainCondition = Condition; // No "in" or "not in" found, use the whole condition
        }

        // Modify the query to include both the spaceId and the regex for the condition in the description
        const rules = await Rule.find({ 
            description: regex, 
            isActive: true,
            space_id: data.spaceId // Ensure spaceId matches the one provided in data
        });

        if (rules.length > 0) {
            for (const rule of rules) {
                if (mainCondition === 'temperature' || mainCondition === 'humidity') {
                    await interpret(rule.description, data, res, Context); // Process each rule found
                }
                await interpret(rule.description, data, res, Context); 
            }
        } else {
            if (!res.headersSent && !alreadyTried) {
                res.status(404).json({ message: "No matching rules found", success: false });
            } else if (!res.headersSent) {
                res.status(200).json({ message: "No new rules found, but request processed." });
            }
        }
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ error: `Error fetching rules: ${error.message}` });
        }
    }
}


async function interpret(ruleDescriptionQuery, data, res, Context) {
    try {
        const tokens = tokenize(ruleDescriptionQuery); // Tokenize the rule description
        const parsed = parse(tokens); // Convert tokens to a structured format
        await processData(parsed, data, res, Context);
    } catch (error) {
        if (!res.headersSent) {
            // console.log("+*+*+*+*+*+*+*+*+*+*+*+*")
            res.status(500).json({ error: `Failed to interpret rule due to error: ${error.message}` });
            // console.log("+*+*+*+*+*+*+*+*+*+*+*+*")

        }
    }
}


async function interpretRuleByNameHumD(Condition, data, shouldSendRes = false, res = null, alreadyTried = false) {
  try {
        // console.log(Condition);
        // console.log(data.spaceId);
        const regex = new RegExp(escapeRegex(Condition), 'i');

        let mainCondition;
        if (Condition.includes(' in ')) {
            mainCondition = Condition.split(' in ')[0]; // e.g., "temperature"
        } else if (Condition.includes(' not in ')) {
            mainCondition = Condition.split(' not in ')[0]; // e.g., "temperature"
        } else {
            mainCondition = Condition; // No "in" or "not in" found, use the whole condition
        }

        console.log(mainCondition);
        // Modify the query to include both the spaceId and the regex for the condition in the description
        const rules = await Rule.find({ 
            description: regex, 
            isActive: true,
            space_id: data.spaceId // Ensure spaceId matches the one provided in data
        });

        if (rules.length > 0) {
            for (const rule of rules) {
                if (mainCondition === 'temperature' || mainCondition === 'humidity') {
                  await Interpret(rule.description, data, shouldSendRes, Context= null); // Process each rule found
                }
                await Interpret(rule.description, data, res, Context); 
            }
        } else {
          if (shouldSendRes && res && !res.headersSent && !alreadyTried) {
            res.status(404).json({ message: "No matching rules found", success: false });
          } else if (shouldSendRes && res && !res.headersSent) {
            res.status(200).json({ message: "No new rules found, but request processed." });
          } else {
            console.log("No matching rules found");
          }
        }
    } catch (error) {
      if (shouldSendRes && res && !res.headersSent) {
        res.status(500).json({ error: `Error fetching rules: ${error.message}` });
      } else {
        console.error(`Error fetching rules: ${error.message}`);
      }
    }
}

async function interpretRuleByNameCalendar(Condition, data, shouldSendRes = false, res = null, Context, alreadyTried = false) {
    try {
        // console.log(Condition);
        // console.log(data.space_id);
        const regex = new RegExp(escapeRegex(Condition), 'i');

        let mainCondition;
        if (Condition.includes('start')) {
            mainCondition = Condition.split('start')[0]; // e.g., "temperature"
        } else if (Condition.includes('end')) {
            mainCondition = Condition.split('end')[0]; // e.g., "temperature"
        } else {
            mainCondition = Condition; // No "in" or "not in" found, use the whole condition
        }
        // console.log(mainCondition);

        const rules = await Rule.find({ 
            description: regex, 
            isActive: true,
            space_id: data.space_id // Ensure spaceId matches the one provided in data
        });

        if (rules.length > 0) {
            for (const rule of rules) {
                await Interpret(rule.description, data, shouldSendRes, res, Context); // Process each rule found
            }
        } else {
            if (shouldSendRes && res && !res.headersSent && !alreadyTried) {
                res.status(404).json({ message: "No matching rules found", success: false });
            } else if (shouldSendRes && res && !res.headersSent) {
                res.status(200).json({ message: "No new rules found, but request processed." });
            } else {
                console.log("No matching rules found");
            }
        }
    } catch (error) {
        if (shouldSendRes && res && !res.headersSent) {
            res.status(500).json({ error: `Error fetching rules: ${error.message}` });
        } else {
            console.error(`Error fetching rules: ${error.message}`);
        }
    }
}

async function Interpret(ruleDescriptionQuery, data, shouldSendRes = false, res = null, Context) {
    try {
        console.log("*/*/*/*/**/*/*/*/*/*/")
        console.log("data in intterpret is :::",data)
        console.log("*/*/*/*/**/*/*/*/*/*/")
        console.log("rule description is :::",ruleDescriptionQuery)
        console.log("*/*/*/*/**/*/*/*/*/*/")

        console.log("*/*/*/*/**/*/*/*/*/*/")
        const tokens = tokenize(ruleDescriptionQuery); // Tokenize the rule description
        console.log("tokens is :: ",tokens)
        console.log("*/*/*/*/**/*/*/*/*/*/")

        const parsed = parse(tokens); // Convert tokens to a structured format
        console.log("parsed is  is :: ",tokens)
        console.log("*/*/*/*/**/*/*/*/*/*/")
        const room = await Room.findOne({ id: data.roomId });

        if (room) {
            // Destructuring the roomName and roomDetails
            const { name: roomName, ...roomDetails } = room._doc;  // Access plain data

            console.log("Room Name:", roomName);
            console.log("Room Details:", roomDetails);  // E
        
        }

        try {
            await processData(parsed, data, shouldSendRes ? res : null, Context);
        } catch (processDataError) {
            console.error("Error inside processData:", processDataError);
            if (shouldSendRes && res && !res.headersSent) {
                res.status(500).json({ error: `Failed to process data: ${processDataError.message}` });
            }
        }
    } catch (error) {
        if (shouldSendRes && res && !res.headersSent) {
            // console.log("+*+*+*+*+*+*+*+*+*+*+*+*")

            res.status(500).json({ error: `Failed to interpret rule due to error: ${error.message}` });
            // console.log("+*+*+*+*+*+*+*+*+*+*+*+*")

        } else {
            console.log("+*+*+*+*+*+*+*+*+*+*+*+*")

            console.error(`Failed to interpret rule due to error: ${error.message}`);
            console.log("+*+*+*+*+*+*+*+*+*+*+*+*")

        }
    }
}
module.exports = {
    GetRoomNameFromDatabase,
    interpretRuleByName,
    interpretRuleByNameHumD,
    interpretRuleByNameCalendar
};
