const config                = require('./config/index.config.js');
const Cortex                = require('ion-cortex');
const ManagersLoader        = require('./loaders/ManagersLoader.js');
const Aeon                  = require('aeon-machine');
const mongo                 = require('./connect/mongo.js');
const mongoose              = require('mongoose');

// Connect to MongoDB
if (config.dotEnv.MONGO_URI) {
    mongo({ uri: config.dotEnv.MONGO_URI });
}

process.on('uncaughtException', err => {
    console.log(`Uncaught Exception:`)
    console.log(err, err.stack);

    process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled rejection at ', promise, `reason:`, reason);
    process.exit(1)
})

const cache      = require('./cache/cache.dbh')({
    prefix: config.dotEnv.CACHE_PREFIX ,
    url: config.dotEnv.CACHE_REDIS
});

const Oyster  = require('oyster-db');
const oyster     = new Oyster({ 
    url: config.dotEnv.OYSTER_REDIS, 
	prefix: config.dotEnv.OYSTER_PREFIX 
});

const cortex     = new Cortex({
    prefix: config.dotEnv.CORTEX_PREFIX,
    url: config.dotEnv.CORTEX_REDIS,
    type: config.dotEnv.CORTEX_TYPE,
    state: ()=>{
        return {} 
    },
    activeDelay: "50",
    idlDelay: "200",
});
const aeon = new Aeon({ cortex , timestampFrom: Date.now(), segmantDuration: 500 });

const managersLoader = new ManagersLoader({config, cache, cortex, oyster, aeon});
const managers = managersLoader.load();

managers.userServer.run();

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    // Give existing requests time to complete (30 second timeout)
    const shutdownTimeout = setTimeout(() => {
        console.log('Shutdown timeout reached, forcing exit...');
        process.exit(1);
    }, 30000);

    try {
        // Close MongoDB connection
        if (mongoose.connection.readyState === 1) {
            console.log('Closing MongoDB connection...');
            await mongoose.connection.close();
            console.log('MongoDB connection closed.');
        }

        // Clear timeout and exit cleanly
        clearTimeout(shutdownTimeout);
        console.log('Graceful shutdown completed.');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        clearTimeout(shutdownTimeout);
        process.exit(1);
    }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
