// Ensure the necessary modules are imported
const request = require('supertest');
const app = require('../app');  
const sequelize = require('../config/database');
const User = require('../models/usermodel'); 
const statsdClient = require('../statsd'); 
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn()
}));

jest.mock('winston', () => {
    const mLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
    return {
        createLogger: jest.fn(() => mLogger),
        format: {
            combine: jest.fn(),
            timestamp: jest.fn(),
            printf: jest.fn(),
            errors: jest.fn()
        },
        transports: {
            Console: jest.fn(),
            File: jest.fn()
        }
    };
});
beforeAll(async () => {
    await sequelize.sync({ force: true });  
  });
  
describe('User API', () => {
    let server;

    
    let userId;
    let authHeader;

    it('create new user', async () => {
        // a unique email to avoid conflicts
        const uniqueSuffix = Date.now();
        const userData = {
            email: `testing${uniqueSuffix}@gmail.com`,
            first_name: 'test',
            last_name: 'user',
            password: 'Password@456'
        };

        const response = await request(app)
            .post('/v1/user')
            .send(userData)
            .expect('Content-Type', /json/)
            .expect(201);

        // if user was created successfully
        if (response.statusCode !== 201) {
            console.error("User creation failed");
            return; 
        }

        // user ID and authorization header for use in other test
        userId = response.body.id;
        authHeader = `Basic ${Buffer.from(`${userData.email}:${userData.password}`).toString('base64')}`;
    });

    describe('Update User', () => {
        it('updating allowed fields', async () => {
            // authorization header is set  
            if (!authHeader) {
                console.error("auth setup is incomplete.");
                return;  
            }

            // update user
            await request(app)
                .put('/v1/user/self')
                .set('Authorization', authHeader)
                .send({ first_name: "updated", last_name: "updatedlast" })
                .expect(204);  
        });
    });

    describe('Duplicate Email Registration', () => {
        it('registration not allowed for existing email', async () => {
            const uniqueSuffix = Date.now();
            const userData = {
                email: `dupli${uniqueSuffix}@hotmail.com`, 
                first_name: 'duplicate',
                last_name: 'test',
                password: 'Password@456'
            };
    
            // First user registration
            await request(app)
                .post('/v1/user')
                .send(userData)
                .expect(201);
    
            // Second user registration with the same email 
            await request(app)
                .post('/v1/user')
                .send(userData)
                .expect(409);  
        });
    });
});
    describe('Authentication', () => {
        it('reject auth with wrong password', async () => {
            // Create a unique email for each user to avoid conflicts
            const uniqueSuffix = Date.now();
            const userData = {
                email: `auth${uniqueSuffix}@yahoo.com`,
                first_name: 'auth',
                last_name: 'user',
                password: 'Password@456'
            };

            // new user
            await request(app)
                .post('/v1/user')
                .send(userData)
                .expect(201);

            //correct email & wrong pass
            const wrongAuthHeader = `Basic ${Buffer.from(`${userData.email}:wrongpassword`).toString('base64')}`;

            // authenticate with wrong pass
            await request(app)
                .get('/v1/user/self')
                .set('Authorization', wrongAuthHeader)
                .expect(401);   
        });

        it(' authenticate with correct username and pass', async () => {
             
            const uniqueSuffix = Date.now();
            const userData = {
                email: `correct${uniqueSuffix}@gmail.com`,
                first_name: 'correct',
                last_name: 'user',
                password: 'Password@456'
            };

            // new user
            const response = await request(app)
                .post('/v1/user')
                .send(userData)
                .expect(201);
            const authHeader = `Basic ${Buffer.from(`${userData.email}:${userData.password}`).toString('base64')}`;

            // Authenticate with correct id, pass
            await request(app)
                .get('/v1/user/self')
                .set('Authorization', authHeader)
                .expect(200);   
        });
    });
        

    afterAll(async () => {
        await sequelize.close();   
        if (statsdClient && typeof statsdClient.close === 'function') {
            statsdClient.close();  
        }
    });