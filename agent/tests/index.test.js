const request = require('supertest');
const app = require('../index');

// Use a consistent API key for testing
const TEST_API_KEY = 'test-api-key';
process.env.AGENT_API_KEY = TEST_API_KEY;

describe('DUITS Agent API', () => {
  describe('Authentication', () => {
    test('should reject requests without API key', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
    });

    test('should accept requests with correct API key', async () => {
      const res = await request(app)
        .get('/health')
        .set('x-api-key', TEST_API_KEY);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });

    test('should accept API key in Authorization header', async () => {
      const res = await request(app)
        .get('/health')
        .set('Authorization', `Bearer ${TEST_API_KEY}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  describe('Info Endpoint', () => {
    test('should return agent information', async () => {
      const res = await request(app)
        .get('/info')
        .set('x-api-key', TEST_API_KEY);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('description');
      expect(res.body).toHaveProperty('serverInfo');
    });
  });

  describe('Query Endpoint', () => {
    test('should require host parameter', async () => {
      const res = await request(app)
        .get('/query')
        .set('x-api-key', TEST_API_KEY);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing or invalid host');
    });

    test('should reject invalid port', async () => {
      const res = await request(app)
        .get('/query?host=example.com&port=notaport')
        .set('x-api-key', TEST_API_KEY);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid port');
    });

    test('should accept valid query parameters', async () => {
      // This is a mock test that doesn't actually perform a real query
      // In a real integration test, you would use a test server
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create a partial mock of the QueryClient
      jest.mock('../../lib/query', () => {
        return jest.fn().mockImplementation(() => {
          return {
            queryBasic: jest.fn().mockRejectedValue(new Error('Connection refused')),
            host: 'example.com',
            port: 25565,
            close: jest.fn()
          };
        });
      });

      const res = await request(app)
        .get('/query?host=example.com&port=25565&mode=basic')
        .set('x-api-key', TEST_API_KEY);
      
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('RCON Endpoints', () => {
    test('should validate connect parameters', async () => {
      const res = await request(app)
        .post('/rcon/connect')
        .set('x-api-key', TEST_API_KEY)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing or invalid host');
    });

    test('should validate port', async () => {
      const res = await request(app)
        .post('/rcon/connect')
        .set('x-api-key', TEST_API_KEY)
        .send({ host: 'example.com', port: 'invalid', password: 'test' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid port');
    });

    test('should validate password', async () => {
      const res = await request(app)
        .post('/rcon/connect')
        .set('x-api-key', TEST_API_KEY)
        .send({ host: 'example.com', port: 25575 });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing or invalid password');
    });

    test('should require clientId for command', async () => {
      const res = await request(app)
        .post('/rcon/command')
        .set('x-api-key', TEST_API_KEY)
        .send({ command: 'help' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing clientId parameter');
    });

    test('should validate command', async () => {
      const res = await request(app)
        .post('/rcon/command')
        .set('x-api-key', TEST_API_KEY)
        .send({ clientId: 'test-id' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing or invalid command');
    });

    test('should require clientId for disconnect', async () => {
      const res = await request(app)
        .post('/rcon/disconnect')
        .set('x-api-key', TEST_API_KEY)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing clientId parameter');
    });
  });

  describe('SMB Endpoints', () => {
    test('should require host and share on connect', async () => {
      const res = await request(app)
        .post('/smb/connect')
        .set('x-api-key', TEST_API_KEY)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing host or share');
    });

    test('should require clientId for readdir', async () => {
      const res = await request(app)
        .get('/smb/readdir')
        .set('x-api-key', TEST_API_KEY);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing clientId parameter');
    });

    test('should require clientId for stat', async () => {
      const res = await request(app)
        .get('/smb/stat')
        .set('x-api-key', TEST_API_KEY);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing clientId parameter');
    });

    test('should require path for stat', async () => {
      const res = await request(app)
        .get('/smb/stat?clientId=test-id')
        .set('x-api-key', TEST_API_KEY);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing file path');
    });
  });

  describe('MySQL Endpoints', () => {
    test('should require host, user, database on connect', async () => {
      const res = await request(app)
        .post('/mysql/connect')
        .set('x-api-key', TEST_API_KEY)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing required parameters');
    });

    test('should validate port', async () => {
      const res = await request(app)
        .post('/mysql/connect')
        .set('x-api-key', TEST_API_KEY)
        .send({ host: 'localhost', port: 'invalid', user: 'root', database: 'test' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid port');
    });

    test('should require clientId for query', async () => {
      const res = await request(app)
        .post('/mysql/query')
        .set('x-api-key', TEST_API_KEY)
        .send({ sql: 'SELECT 1' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing clientId parameter');
    });
  });
});