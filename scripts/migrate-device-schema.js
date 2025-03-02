require('dotenv').config();
const mongoose = require('mongoose');
const Device = require('../models/Device');
const RoomDevice = require('../models/RoomDevice');

async function migrateDevices() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        // First, find all devices with string mode
        const devicesWithStringMode = await Device.find({
            mode: { $type: "string" }
        });

        // Update these devices first
        for (const device of devicesWithStringMode) {
            const oldMode = device.mode;
            await Device.updateOne(
                { _id: device._id },
                {
                    $set: {
                        mode: {
                            type: oldMode,
                            temperature: null,
                            fanLevel: null,
                            swing: null
                        }
                    }
                },
                { new: true }
            );
        }

        // Now update all devices with the new fields, but preserve existing data
        const deviceResult = await Device.updateMany(
            { mode: { $type: "object" } },
            {
                $set: {
                    'mode.temperature': { $ifNull: ['$mode.temperature', null] },
                    'mode.fanLevel': { $ifNull: ['$mode.fanLevel', null] },
                    'mode.swing': { $ifNull: ['$mode.swing', null] },
                    'lastUpdated': new Date()
                }
            }
        );

        // Do the same for RoomDevice collection
        const roomDevicesWithStringMode = await RoomDevice.find({
            mode: { $type: "string" }
        });

        for (const device of roomDevicesWithStringMode) {
            const oldMode = device.mode;
            await RoomDevice.updateOne(
                { _id: device._id },
                {
                    $set: {
                        mode: {
                            type: oldMode,
                            temperature: null,
                            fanLevel: null,
                            swing: null
                        }
                    }
                },
                { new: true }
            );
        }

        const roomDeviceResult = await RoomDevice.updateMany(
            { mode: { $type: "object" } },
            {
                $set: {
                    'mode.temperature': { $ifNull: ['$mode.temperature', null] },
                    'mode.fanLevel': { $ifNull: ['$mode.fanLevel', null] },
                    'mode.swing': { $ifNull: ['$mode.swing', null] },
                    'lastUpdated': new Date()
                }
            }
        );

        console.log(`Updated ${deviceResult.modifiedCount} devices`);
        console.log(`Updated ${roomDeviceResult.modifiedCount} room devices`);
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run migration
migrateDevices(); 