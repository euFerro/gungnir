import { BardLogger } from './bard-logger';

describe('BardLogger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'test', APP_DEBUG_LEVEL: 'debug' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('log methods', () => {
    it('should write debug messages to stdout', () => {
      // Arrange
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const log = new BardLogger('Test');

      // Act
      log.debug('debug message');

      // Assert
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy.mock.calls[0][0]).toContain('debug message');

      writeSpy.mockRestore();
    }, 1000);

    it('should write info messages to stdout', () => {
      // Arrange
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const log = new BardLogger('Test');

      // Act
      log.info('info message');

      // Assert
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy.mock.calls[0][0]).toContain('info message');

      writeSpy.mockRestore();
    }, 1000);

    it('should write warn messages to stdout', () => {
      // Arrange
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const log = new BardLogger('Test');

      // Act
      log.warn('warn message');

      // Assert
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy.mock.calls[0][0]).toContain('warn message');

      writeSpy.mockRestore();
    }, 1000);

    it('should write error messages to stderr', () => {
      // Arrange
      const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const log = new BardLogger('Test');

      // Act
      log.error('error message');

      // Assert
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy.mock.calls[0][0]).toContain('error message');

      writeSpy.mockRestore();
    }, 1000);
  });

  describe('context', () => {
    it('should include context tag in output', () => {
      // Arrange
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const log = new BardLogger('MyModule');

      // Act
      log.info('test');

      // Assert
      expect(writeSpy.mock.calls[0][0]).toContain('[MyModule]');

      writeSpy.mockRestore();
    }, 1000);
  });

  describe('child', () => {
    it('should create a child logger with a different context', () => {
      // Arrange
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const parent = new BardLogger('Parent');

      // Act
      const child = parent.child('Child');
      child.info('from child');

      // Assert
      expect(writeSpy.mock.calls[0][0]).toContain('[Child]');

      writeSpy.mockRestore();
    }, 1000);
  });

  describe('metadata', () => {
    it('should include metadata in output', () => {
      // Arrange
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const log = new BardLogger('Test');

      // Act
      log.info('request', { method: 'GET', url: '/api' });

      // Assert
      const output = writeSpy.mock.calls[0][0] as string;
      expect(output).toContain('method=');
      expect(output).toContain('GET');
      expect(output).toContain('url=');
      expect(output).toContain('/api');

      writeSpy.mockRestore();
    }, 1000);
  });

  describe('log level filtering', () => {
    it('should suppress debug when level is info', () => {
      // Arrange
      process.env.APP_DEBUG_LEVEL = 'info';
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const log = new BardLogger('Test');

      // Act
      log.debug('should not appear');

      // Assert
      expect(writeSpy).not.toHaveBeenCalled();

      writeSpy.mockRestore();
    }, 1000);

    it('should suppress all output when level is silent', () => {
      // Arrange
      process.env.APP_DEBUG_LEVEL = 'silent';
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const log = new BardLogger('Test');

      // Act
      log.debug('nope');
      log.info('nope');
      log.warn('nope');
      log.error('nope');

      // Assert
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();

      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    }, 1000);
  });
});
