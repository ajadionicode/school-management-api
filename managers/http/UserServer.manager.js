const http              = require('http');
const express           = require('express');
const cors              = require('cors');
const path              = require('path');
const mongoose          = require('mongoose');
const app               = express();

// Swagger UI setup
let swaggerUi, swaggerDocument;
try {
    swaggerUi = require('swagger-ui-express');
    const YAML = require('yamljs');
    swaggerDocument = YAML.load(path.join(__dirname, '../../docs/openapi.yaml'));
} catch (err) {
    console.log('Swagger UI not available:', err.message);
}

module.exports = class UserServer {
    constructor({config, managers}){
        this.config        = config;
        this.userApi       = managers.userApi;
    }

    /** for injecting middlewares */
    use(args){
        app.use(args);
    }

    /** server configs */
    run(){
        app.use(cors({origin: '*'}));
        app.use(express.json());
        app.use(express.urlencoded({ extended: true}));
        app.use('/static', express.static('public'));

        // Swagger UI documentation
        if (swaggerUi && swaggerDocument) {
            app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
                customCss: '.swagger-ui .topbar { display: none }',
                customSiteTitle: 'School Management API'
            }));
            console.log('API Documentation available at /api-docs');
        }

        // Health check endpoint
        app.get('/health', async (req, res) => {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                services: {
                    mongodb: 'disconnected',
                    redis: 'unknown'
                }
            };

            // Check MongoDB connection
            try {
                const mongoState = mongoose.connection.readyState;
                const states = {
                    0: 'disconnected',
                    1: 'connected',
                    2: 'connecting',
                    3: 'disconnecting'
                };
                health.services.mongodb = states[mongoState] || 'unknown';
            } catch (err) {
                health.services.mongodb = 'error';
            }

            // Determine overall status
            const isHealthy = health.services.mongodb === 'connected';
            health.status = isHealthy ? 'ok' : 'degraded';

            res.status(isHealthy ? 200 : 503).json(health);
        });

        /** an error handler */
        app.use((err, req, res, next) => {
            console.error(err.stack)
            res.status(500).send('Something broke!')
        });

        /** a single middleware to handle all */
        app.all('/api/:moduleName/:fnName', this.userApi.mw);

        let server = http.createServer(app);
        server.listen(this.config.dotEnv.USER_PORT, () => {
            console.log(`${(this.config.dotEnv.SERVICE_NAME).toUpperCase()} is running on port: ${this.config.dotEnv.USER_PORT}`);
        });
    }
}