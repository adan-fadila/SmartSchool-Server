const Rule = require("../models/Rule");
const Device = require("./../models/Device.js");
const RoomDevice = require("./../models/RoomDevice");
const { ObjectId, Int32 } = require("bson");
const { getSensors } = require("./sensors.service");
const { createRegexPattern, replaceWords } = require("../utils/utils");
const { getUsers } = require("./users.service");
const _ = require("lodash");
const { getSensiboSensors } = require('../api/sensibo')
const { tokenize } = require('../interpeter/src/lexer/lexer');
const { parse } = require('../interpeter/src/parser/parser');
const { execute } = require('../interpeter/src/execute/execute');
const { getCurrentActivity, getCurrentSeason } = require('./time.service'); // Import both getCurrentActivity and getCurrentSeason
const { getRooms,getRoomById,getRoomIdByRoomName,get_Rooms_By_SpaceId,getAllRoomIds,getAllRoomNames} = require('./rooms.service');  
const { get_MotionState, update_Motion_DetectedState} = require('../controllers/sensorController.js');


const validateRule = async (rule) => {
  const parsedRule = rule.split(" ");
  if (parsedRule[0] !== "IF") {
    return {
      statusCode: 400,
      message: "Rule must start with IF",
    };
  }

  if (
    !/\b(kitchen|living room|dining room|bedroom|bathroom|bedroom|Class246|Class247)\b/i.test(
      rule
    )
  ) {
    return {
      statusCode: 400,
      message: "You must specify a room",
    };
  }

  if (!/THEN TURN\(".*"\)$/i.test(rule)) {
    return {
      statusCode: 400,
      message: "Rule must contain 'THEN TURN(...)' after the condition",
    };
  }

  return {
    statusCode: 200,
    message: "Rule  validated successfully",
  };
};




const ruleFormatter = async (rule) => {
  const usersResponse = await getUsers();
  const users = usersResponse.data.map(
    ({ fullName }) => fullName.split(" ")[0]
  );
  const usersMap = createUserDistanceMap(users);

  const homeMap = { home: "0.001" };

  // replace operator

  rule = replaceWords(rule, OPERATORS_MAP_FORMATTER);
  rule = replaceWords(rule, SEASONS_MAP_FORMATTER);
  rule = replaceWords(rule, HOURS_MAP_FORMATTER);
  rule = replaceWords(rule, usersMap);
  rule = replaceWords(rule, homeMap);

  
  //add (" ")
  const index = rule.indexOf("TURN") + 4;
  rule =
  rule.slice(0, index) + `("` + rule.slice(index + 1, rule.length) + `")`;
  return rule;
};


function stringifyCondition(condition) {
  return `IF ${condition.variable} ${condition.operator} ${condition.value}`;
}




const getAllRulesDescription = async () => {
  try {
    const rules = await Rule.find({});
    console.log("rules: ", rules);
    const activeDevices = await Device.find({state: 'on' });

    
    let activeDescriptions = [];
    let devicesStateMap = {};
    console.log('Active devices found:', activeDevices.length);

     // Create a map of active devices for quick lookup
      activeDevices.forEach(device => {
      devicesStateMap[device.device_id] = device.state;
    });

    console.log('Devices state map:', devicesStateMap);

      for (const rule of rules) {
        if (rule.isActive) {
          activeDescriptions.push(rule.description);
        }
      }
    
    if (activeDescriptions.length > 0) {
      return {
        statusCode: 200,
        data: activeDescriptions, 
      };
    } else {
      return {
        statusCode: 201, 
        message: "No active rules found",
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      message: `Error fetching rules - ${error}`,
    };
  }
};


async function updateAndProcessRules() {
  try {
    const descriptionResult = await getAllRulesDescription();
    console.log("descriptionResult:", descriptionResult);

    if (descriptionResult.statusCode === 200) {
      const descriptions = descriptionResult.data;
      // console.log("Descriptions of rules:", descriptions);

      for (const description of descriptions) {
        try {
          const interpretResult = await interpretRuleByName(description);
          // console.log("Interpret result for rule:", description, interpretResult);

          // Check if interpretResult is a string and includes 'successfully'
          if (typeof interpretResult === 'string' && interpretResult.includes("successfully")) {
            console.log("Rule interpreted successfully");
            continue; // Continue processing other rules
          }
        } catch (error) {
          console.error(`Failed to interpret rule "${description}":`, error.message);
        }
      }
      return "All rules processed"; // If all rules are processed without breaking the loop
    } else {
      console.error('Failed to get rule descriptions:', descriptionResult.message);
    }
  } catch (error) {
    console.error('Error processing rule descriptions:', error);
  }
  return "No active rules"; // Return this if no rules are processed successfully
}

async function checkInterpreterCondition() {
  try {
    const interpretResult = await updateAndProcessRules(); 
    console.log("in checkInterpreterCondition Function, interpretResult:", interpretResult);
    if (interpretResult === "Rule interpreted successfully") {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking interpreter condition:', error);
    return false; // Return false in case of an error
  }
}
// Run the function immediately
updateAndProcessRules();
checkInterpreterCondition();
// Set an interval to run the function every 30 seconds
// setInterval(updateAndProcessRules, 30000);


async function processAllRules(context) {
  try {
    // Await the promise to get the result object
    const descriptionResult = await getAllRulesDescription();
    // console.log(descriptionResult);

    // Check if the operation was successful
    if (descriptionResult.statusCode === 200) {
      // Extract the descriptions array
      const descriptions = descriptionResult.data;
      let acRules = [];
      let lightRules = [];
      let tapRules = [];      
      for (const description of descriptions) {

        // // Await the interpretation of each rule description
        // const interpretResult = await interpretRuleByName(description, context);
        // console.log(interpretResult);
        if (description.toLowerCase().includes("ac")) {
          const interpretResult = await interpretRuleByName(description, context);
          acRules.push(description);
        } else if (description.toLowerCase().includes("light")) {
          const interpretResult = await interpretRuleByName(description, context = null);
          lightRules.push(description);

        }else if (description.toLowerCase().includes("tap")) {
          const interpretResult = await interpretRuleByName(description, context = null);
          tapRules.push(description);

        }
      }
    } else {
      console.error('Failed to get rule descriptions:', descriptionResult.message);
    }
  } catch (error) {
    console.error('Error processing rule descriptions:', error);
  }
}




async function interpretRuleByName(ruleDescription) {
  try {
    console.log(ruleDescription);
    const rules = await Rule.find({ description: ruleDescription });
    // console.log(`Number of rules found: ${rules.length}`);
    if (rules.length > 0) {
      rules.forEach(rule => {
        interpret(rule.description); // Simulate rule interpretation
        console.log(`Rule "${rule.description}" interpreted successfully.`);
      });
      return {
        success: true,
        message: `Interpreted ${rules.length} rule(s) successfully.`,
        rules: rules.map(rule => ({
          description: rule.description,
          interpreted: true,
          details: rule
        }))
      };
    } else {
      console.log(`No rules found with description "${ruleDescription}".`);
      return {
        success: false,
        message: `No rules found with description "${ruleDescription}".`,
        rules: []
      };
    }
  } catch (error) {
    console.error(`Error fetching rules: ${error}`);
    return {
      success: false,
      message: `Error fetching rules: ${error.message}`,
      rules: []
    };
  }
}

function interpret(input) {
  const tokens = tokenize(input);
  const parsed = parse(tokens);
  // console.log("Received Parsed:"+ JSON.stringify(parsed));
  execute(parsed);
}


const add_new_Rule = async (ruleData) => {
  console.log("add new Rule");
  
  // Assuming ruleData is structured correctly according to your ruleSchema,
  // e.g., ruleData has description, condition (with variable, operator, value), action, and id
  const newRule = new Rule({
    description: ruleData.description,
    condition: ruleData.condition,
    id: ruleData.id || Math.floor(10000000 + Math.random() * 90000000).toString(),
    space_id: ruleData.space_id
  });

  console.log("rule going to save in the database");

  try {
    await newRule.save();
    console.log('Rule saved successfully');
    return {
      statusCode: 200,
      message: "Rule added successfully",
    };
  } catch (error) {
    console.error('Error saving rule:', error);
    return {
      statusCode: 500,
      message: `Error adding rule - ${error}`,
    };
  }
};

const getAllRules = async () => {
  try {
    const rules = await Rule.find();
    return {
      statusCode: 200,
      data: rules,
    };
  } catch (error) {
    return {
      statusCode: 500,
      message: `Error fetching rules - ${error}`,
    };
  }
};

const getRulesBySpaceId = async (space_id) => {
  try {
    // Modify the query to filter rules based on the space ID
    const rules = await Rule.find({ space_id: space_id });
    return {
      statusCode: 200,
      data: rules,
    };
  } catch (error) {
    return {
      statusCode: 500,
      message: `Error fetching rules for space ID ${space_id} - ${error}`,
    };
  }
};

// Function to format the description of a rule
const descriptionFormatter = async (description) => {
  let formattedDescription = description.trim();
  formattedDescription = formattedDescription.charAt(0).toUpperCase() + formattedDescription.slice(1);

  if (!formattedDescription.startsWith('If')) {
    formattedDescription = 'If ' + formattedDescription;
  }

  // Add any additional formatting rules here

  return formattedDescription;
};

// const actionFormatter = async (action) => {
//   // This should format the action string based on your requirements
//   // For now, this just trims the whitespace
//   return action.trim();
// };
const validateSensor = async (condition) => {
  // Validate the condition object against your sensor requirements
  // Replace the following with actual validation logic
  if (condition && condition.id) {
    // Assuming the condition must have an ID to be valid
    return {
      statusCode: 200,
      message: "Sensor validated successfully",
    };
  } else {
    return {
      statusCode: 400,
      message: "Invalid sensor condition",
    };
  }
};


const updateRule = async (ruleId, updateFields) => {
  try {
    // Process and validate the 'rule' field if it exists
    if (updateFields.rule) {
      const formattedRule = await ruleFormatter(updateFields.rule);
      const ruleValidation = await validateRule(formattedRule);
      if (ruleValidation.statusCode === 400) {
        return ruleValidation;
      }
      // Update the 'rule' field in updateFields
      updateFields.rule = formattedRule;
    }

    // Update and validate the description and action based on the target temperature
    if (updateFields.description) {
      const formattedDescription = await descriptionFormatter(updateFields.description);
      updateFields.description = formattedDescription;

      // Extract the target temperature, assuming it's mentioned after the action context in the description
      const targetTempMatch = formattedDescription.match(/to (\d+)°C/);
      if (targetTempMatch) {
        const newTargetTemp = targetTempMatch[1];

        // Ensure the action array is updated with the new temperature
        if (!updateFields.action) {
          // If action is not present in updateFields, retrieve current action from database
          const currentRule = await Rule.findOne({ id: ruleId });
          updateFields.action = currentRule.action;
        }

        let acActionUpdated = false;
        updateFields.action = updateFields.action.map((act) => {
          if (act.action.includes("Turn AC ON to cool mode at")) {
            acActionUpdated = true;
            return { action: `Turn AC ON to cool mode at ${newTargetTemp}` };
          }
          return act;
        });

        // If AC action was not found and updated, add it to the actions
        if (!acActionUpdated) {
          updateFields.action.push({
            action: `Turn AC ON to cool mode at ${newTargetTemp}`,
          });
        }
      }
    }

    // Validate the sensor condition if it's being updated
    if (updateFields.condition) {
      const sensorValidation = await validateSensor(updateFields.condition);
      if (sensorValidation.statusCode === 400) {
        return sensorValidation;
      }
    }

    // Update the rule in the database
    await Rule.updateOne({ id: ruleId }, { $set: updateFields });
    return {
      statusCode: 200,
      message: "Rule updated successfully",
    };
  } catch (error) {
    return {
      statusCode: 500,
      message: `Error updating rule - ${error}`,
    };
  }
};


async function deleteRuleById(ruleId) {
  try {
    const result = await Rule.deleteOne({ id: ruleId });
    await Rule.deleteMany({ relatedRule: ruleId });
    if (result.deletedCount === 1) {
      return { status: 200 };
    } else {
      return { status: 400 };
    }
  } catch (error) {
    console.error("Error deleting rule:", error);
    return { status: 500 };
  }
}

const toggleActiveStatus = async (ruleId, isActive) => {
  try {
    // Assuming updateRuleActiveStatus is an imported function from your services
    const updatedRule = await updateRuleActiveStatus(ruleId, !isActive); // Toggle the isActive value
    if (updatedRule) {
      console.log()
      toast.success("Rule status updated successfully!");
      // Update the local state in RulesTable to reflect this change
      const updatedRules = currentRules.map(rule =>
        rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
      );
      setCurrentRules(updatedRules);
    }
  } catch (error) {
    console.error("Failed to update rule active status:", error);
    toast.error("Failed to update rule status.");
  }
};


module.exports = {
  // insertRuleToDB,
  add_new_Rule,
  getAllRules,
  updateRule,
  toggleActiveStatus,
  // removeRuleFromDB,
  deleteRuleById,
  getRulesBySpaceId
  // validateRule,
  // insertRuleToDBMiddleware,
  // removeAllRules,
};
