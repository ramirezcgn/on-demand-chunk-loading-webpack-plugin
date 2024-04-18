import { RuntimeModule, RuntimeGlobals, Template } from 'webpack';

export default class JsonpChunkLoadingRuntimeModule extends RuntimeModule {
  _runtimeRequirements: Set<string>;

  constructor(runtimeRequirements: Set<string>) {
    super('on demand chunk loading', RuntimeModule.STAGE_ATTACH);
    this._runtimeRequirements = runtimeRequirements;
  }

  generate() {
    const withOnChunkLoad = this._runtimeRequirements.has(
      RuntimeGlobals.onChunksLoaded
    );
    const withEnsureChunk = this._runtimeRequirements.has(
      RuntimeGlobals.ensureChunk
    );
    // Check https://github.com/webpack/webpack/blob/main/lib/web/JsonpChunkLoadingRuntimeModule.js#L258
    return withOnChunkLoad && withEnsureChunk
      ? Template.asString([
          `${RuntimeGlobals.onChunksLoaded}.k = (chunkId) => {`,
          Template.indent([
            `if (!${RuntimeGlobals.onChunksLoaded}.j(chunkId)) {`,
            Template.indent([
              `${RuntimeGlobals.ensureChunk}(chunkId);`,
              'return false;',
            ]),
            '}',
            'return true;',
          ]),
          '};',
        ])
      : '// no on chunks loaded';
  }
}
