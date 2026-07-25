// Import de efecto lateral. Debe ir ANTES de importar `AppModule`: `ConfigModule.forRoot()` lee el
// entorno cuando se evalúa el decorador del módulo, o sea al importarlo.
process.env['NODE_ENV'] = 'development';
