router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const {description, operator, value, deviceId, actionCommand, space_id, sensorType, eventName} = req.body;

        // Validate required fields
        if (!description || !operator || !value || !actionCommand || !space_id) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields"
            });
        }

        // Create rule string for interpreter
        let ruleString = description;
        
        // Create rule in interpreter
        const interpreterService = require('../interpreter/src/server-integration');
        const interpreterResult = await interpreterService.createRule(ruleString);
        
        if (!interpreterResult.success) {
            console.error('Failed to create rule in interpreter:', interpreterResult.error);
            return res.status(500).json({
                success: false,
                error: `Failed to create rule in interpreter: ${interpreterResult.error}`
            });
        }
        
        // Create rule in database
        const newRule = new Rule({
            description,
            operator,
            value,
            deviceId,
            actionCommand,
            space_id,
            sensorType,
            eventName,
            createdBy: userId,
            interpreterId: interpreterResult.ruleId // Store the interpreter rule ID
        });

        await newRule.save();
        
        res.status(201).json({
            success: true,
            data: newRule,
            interpreterId: interpreterResult.ruleId
        });
    } catch (error) {
        console.error("Error creating rule:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}); 