import { Compiler, Chunk, RuntimeGlobals } from 'webpack';
import OnDemandChunkLoadingRuntimeModule from './OnDemandChunkLoadingRuntimeModule';

export default class OnDemandChunkLoadingPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(
      'OnDemandChunkLoadingPlugin',
      compilation => {
        const globalChunkLoading = compilation.outputOptions.chunkLoading;

        const isEnabledForChunk = (chunk: Chunk) => {
          const options = chunk.getEntryOptions();
          const chunkLoading =
            options && options.chunkLoading !== undefined
              ? options.chunkLoading
              : globalChunkLoading;
          return chunkLoading === 'jsonp';
        };

        compilation.hooks.runtimeRequirementInTree
          .for(RuntimeGlobals.onChunksLoaded)
          .tap('OnDemandChunkLoadingPlugin', (chunk, set) => {
            if (!isEnabledForChunk(chunk)) return;
            set.add(RuntimeGlobals.startup);
            set.add(RuntimeGlobals.ensureChunk);
            set.add(RuntimeGlobals.ensureChunkIncludeEntries);
            compilation.addRuntimeModule(
              chunk,
              new OnDemandChunkLoadingRuntimeModule(set)
            );
          });
      }
    );
  }
}
