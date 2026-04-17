/**
 * 事件总线模块统一导出
 */

export { EventBus, CoreEventType } from './EventBus';
export type { 
  PluginEventType,
  AnyEventType,
  BaseEvent,
  CoreEvent,
  PluginEvent,
  CoreEventPayloadMap,
  RequestHandler,
  EventHandler 
} from './types';
