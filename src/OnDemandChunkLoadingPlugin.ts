import { Compiler, Chunk, RuntimeGlobals } from 'webpack';
import OnDemandChunkLoadingRuntimeModule from './OnDemandChunkLoadingRuntimeModule';
import MiniCssExtractLoadingRuntimeModule from './MiniCssExtractLoadingRuntimeModule';

export default class OnDemandChunkLoadingPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(
      'OnDemandChunkLoadingPlugin',
      compilation => {
        const globalChunkLoading = compilation.outputOptions.chunkLoading;
        const enabledChunks = new WeakSet();

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
              new OnDemandChunkLoadingRuntimeModule(set),
            );
          });

        compilation.hooks.runtimeRequirementInTree
          .for(RuntimeGlobals.ensureChunkHandlers)
          .tap('OnDemandChunkLoadingPlugin', (chunk, set) => {
            if (enabledChunks.has(chunk)) {
              return;
            }
            enabledChunks.add(chunk);
            compilation.addRuntimeModule(
              chunk,
              new MiniCssExtractLoadingRuntimeModule(set),
            );
          });
      },
    );
  }
}
