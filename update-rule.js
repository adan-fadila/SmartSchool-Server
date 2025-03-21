const mongoose = require("mongoose");
const Rule = require("./models/Rule");

async function updateRule() {
  try {
    const uri = "mongodb+srv://waleedyounis:YPHTBAn5hOTDXs4y@cluster0.v386sjg.mongodb.net/smart_school_db";
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
    
    // Create a new rule in the interpreter
    const oldRule = await Rule.findOne({ id: "13469543" });
    if (!oldRule) {
      console.log("Rule not found");
      process.exit(1);
    }
    
    console.log("Found rule:", oldRule.description);
    
    // Make an HTTP request to create a new rule
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 8001,
      path: '/api-interpreter/rules',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', async () => {
        const response = JSON.parse(data);
        console.log("Created rule response:", response);
        
        if (response.success) {
          // Update the rule in the database
          const result = await Rule.updateOne(
            { id: "13469543" },
            { $set: { interpreterId: response.ruleId } }
          );
          
          console.log("Update result:", result);
        }
        
        process.exit(0);
      });
    });
    
    req.on('error', (error) => {
      console.error("Error creating rule:", error);
      process.exit(1);
    });
    
    const ruleString = oldRule.ruleString || oldRule.description;
    req.write(JSON.stringify({ ruleString }));
    req.end();
    
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

updateRule(); 