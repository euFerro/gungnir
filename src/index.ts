// App (singleton)
export { app } from './app/bard-app';

// Config
export { defineConfig, config } from './config/bard-config';
export type { DefineConfigOptions, EnvVarDefinition, EnvironmentConfig } from './config/bard-config';

// Logger
export { logger } from './logger/bard-logger';

// Declarative API
export { defineController } from './core/define-controller';
export type { DefineControllerOptions, ControllerFactory, ServiceRouteHandler } from './core/define-controller';
export { defineModule } from './core/define-module';
export type { DefineModuleOptions, RouteDefinition  } from './core/define-module';

// Throttle (presets only, throttler is internal)
export { THROTTLE_CONFIG } from './throttle/throttle.constants';
export type { ThrottlePreset, ThrottleConfig } from './throttle/throttle.constants';

// Exceptions
export {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  GoneException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  TooManyRequestsException,
  InternalServerErrorException,
  NotImplementedException,
  BadGatewayException,
  ServiceUnavailableException,
  GatewayTimeoutException,
} from './exceptions/http.exception';
export type { ExceptionMetadata } from './exceptions/http.exception';
export type { ResponseDefinition } from './core/bard-controller';
