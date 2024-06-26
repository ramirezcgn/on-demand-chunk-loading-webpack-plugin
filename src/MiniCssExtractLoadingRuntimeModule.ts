import { Compilation, Chunk, RuntimeModule, RuntimeGlobals, Template, Module } from 'webpack';
import { SyncWaterfallHook } from 'tapable';

const MODULE_TYPE = 'css/mini-extract';
const compilationHooksMap = new WeakMap();

export default class MiniCssExtractLoadingRuntimeModule extends RuntimeModule {

  runtimeRequirements: Set<string>;

  static getCompilationHooks(compilation: Compilation) {
    let hooks = compilationHooksMap.get(compilation);

    if (!hooks) {
      hooks = {
        beforeTagInsert: new SyncWaterfallHook(
          // @ts-expect-error ble
          ['source', 'varNames'],
          'string',
        ),
        // @ts-expect-error ble
        linkPreload: new SyncWaterfallHook(['source', 'chunk']),
        // @ts-expect-error ble
        linkPrefetch: new SyncWaterfallHook(['source', 'chunk']),
      };
      compilationHooksMap.set(compilation, hooks);
    }

    return hooks;
  }

  constructor(runtimeRequirements: Set<string>) {
    super('css loading', 10);

    this.runtimeRequirements = runtimeRequirements;
  }

  compareModulesByIdentifier = (a: Module, b: Module) => {
    const aId = a.identifier();
    const bId = b.identifier();

    if (typeof aId !== typeof bId) {
      return typeof aId < typeof bId ? -1 : 1;
    }

    if (aId < bId) {
      return -1;
    }

    if (aId > bId) {
      return 1;
    }

    return 0;
  };

  getCssChunkObject = (mainChunk: Chunk, compilation: Compilation) => {
    const obj = {};
    const chunkSet = new Set<Chunk>();
    const includeEntries = compilation.chunkGraph
      .getTreeRuntimeRequirements(mainChunk)
      .has(RuntimeGlobals.ensureChunkIncludeEntries);
    if (includeEntries) {
      for (const c of compilation.chunkGraph.getChunkEntryDependentChunksIterable(mainChunk)) {
        chunkSet.add(c);
      }
    }
    for (const chunk of chunkSet) {
      const modules = compilation.chunkGraph.getOrderedChunkModulesIterable(
        chunk,
        this.compareModulesByIdentifier,
      );
      for (const module of modules) {
        if (module.type === MODULE_TYPE) {
          // @ts-expect-error ble
          obj[chunk.id] = 1;
          break;
        }
      }
    }
    return obj;
  };

  generate() {
    const { chunk, runtimeRequirements } = this;
    if (!this.compilation || !chunk) {
      return '';
    }
    const {
      runtimeTemplate,
      outputOptions: { crossOriginLoading },
    } = this.compilation;
    const chunkMap = this.getCssChunkObject(chunk, this.compilation);
    const withLoading =
      runtimeRequirements.has(RuntimeGlobals.ensureChunkHandlers) &&
      Object.keys(chunkMap).length > 0;
    const withHmr = runtimeRequirements.has(
      RuntimeGlobals.hmrDownloadUpdateHandlers,
    );

    if (!withLoading && !withHmr) {
      return '';
    }

    return Template.asString([
      'if (typeof document === "undefined") return;',
      `var createStylesheet = ${runtimeTemplate.basicFunction(
        'chunkId, fullhref, oldTag, resolve, reject',
        [
          'var linkTag = document.createElement("link");',
          'linkTag.rel = "stylesheet";',
          'linkTag.type = "text/css";',
          `if (${RuntimeGlobals.scriptNonce}) {`,
          Template.indent(
            `linkTag.nonce = ${RuntimeGlobals.scriptNonce};`,
          ),
          '}',
          `var onLinkComplete = ${runtimeTemplate.basicFunction('event', [
            '// avoid mem leaks.',
            'linkTag.onerror = linkTag.onload = null;',
            "if (event.type === 'load') {",
            Template.indent(['resolve();']),
            '} else {',
            Template.indent([
              'var errorType = event && event.type;',
              'var realHref = event && event.target && event.target.href || fullhref;',
              'var err = new Error("Loading CSS chunk " + chunkId + " failed.\\n(" + errorType + ": " + realHref + ")");',
              'err.name = "ChunkLoadError";',
              // TODO remove `code` in the future major release to align with webpack
              'err.code = "CSS_CHUNK_LOAD_FAILED";',
              'err.type = errorType;',
              'err.request = realHref;',
              'if (linkTag.parentNode) linkTag.parentNode.removeChild(linkTag)',
              'reject(err);',
            ]),
            '}',
          ])}`,
          'linkTag.onerror = linkTag.onload = onLinkComplete;',
          'linkTag.href = fullhref;',
          crossOriginLoading
            ? Template.asString([
                'if (linkTag.href.indexOf(window.location.origin + \'/\') !== 0) {',
                Template.indent(
                  `linkTag.crossOrigin = ${JSON.stringify(
                    crossOriginLoading,
                  )};`,
                ),
                '}',
              ])
            : '',
          MiniCssExtractLoadingRuntimeModule.getCompilationHooks(
            this.compilation,
          ).beforeTagInsert.call('', {
            tag: 'linkTag',
            chunkId: 'chunkId',
            href: 'fullhref',
            resolve: 'resolve',
            reject: 'reject',
          }) || '',
          Template.asString([
            'if (oldTag) {',
            Template.indent([
              'oldTag.parentNode.insertBefore(linkTag, oldTag.nextSibling);',
            ]),
            '} else {',
            Template.indent(['document.head.appendChild(linkTag);']),
            '}',
          ]),
          'return linkTag;',
        ],
      )};`,
      `var findStylesheet = ${runtimeTemplate.basicFunction(
        'href, fullhref',
        [
          'var existingLinkTags = document.getElementsByTagName("link");',
          'for(var i = 0; i < existingLinkTags.length; i++) {',
          Template.indent([
            'var tag = existingLinkTags[i];',
            'var dataHref = tag.getAttribute("data-href") || tag.getAttribute("href");',
            'if(tag.rel === "stylesheet" && (dataHref === href || dataHref === fullhref)) return tag;',
          ]),
          '}',
          'var existingStyleTags = document.getElementsByTagName("style");',
          'for(var i = 0; i < existingStyleTags.length; i++) {',
          Template.indent([
            'var tag = existingStyleTags[i];',
            'var dataHref = tag.getAttribute("data-href");',
            'if(dataHref === href || dataHref === fullhref) return tag;',
          ]),
          '}',
        ],
      )};`,
      `var loadStylesheet = ${runtimeTemplate.basicFunction(
        'chunkId',
        `return new Promise(${runtimeTemplate.basicFunction(
          'resolve, reject',
          [
            `var href = ${RuntimeGlobals.require}.miniCssF(chunkId);`,
            `var fullhref = ${RuntimeGlobals.publicPath} + href;`,
            'if(findStylesheet(href, fullhref)) return resolve();',
            'createStylesheet(chunkId, fullhref, null, resolve, reject);',
          ],
        )});`,
      )}`,
      withLoading
        ? Template.asString([
            '// object to store loaded CSS chunks',
            'var installedCssChunks = {',
            Template.indent(
              (chunk.ids || [])
                .map((id) => `${JSON.stringify(id)}: 0`)
                .join(',\n'),
            ),
            '};',
            '',
            `${
              RuntimeGlobals.ensureChunkHandlers
            }.miniCssK = ${runtimeTemplate.basicFunction(
              'chunkId, promises',
              [
                `var cssChunks = ${JSON.stringify(chunkMap)};`,
                'if(installedCssChunks[chunkId]) promises.push(installedCssChunks[chunkId]);',
                'else if(installedCssChunks[chunkId] !== 0 && cssChunks[chunkId]) {',
                Template.indent([
                  `promises.push(installedCssChunks[chunkId] = loadStylesheet(chunkId).then(${runtimeTemplate.basicFunction(
                    '',
                    'installedCssChunks[chunkId] = 0;',
                  )}, ${runtimeTemplate.basicFunction('e', [
                    'delete installedCssChunks[chunkId];',
                    'throw e;',
                  ])}));`,
                ]),
                '}',
              ],
            )};`,
          ])
        : '// no chunk loading',
      '',
      withHmr
        ? Template.asString([
            'var oldTags = [];',
            'var newTags = [];',
            `var applyHandler = ${runtimeTemplate.basicFunction(
              'options',
              [
                `return { dispose: ${runtimeTemplate.basicFunction('', [
                  'for(var i = 0; i < oldTags.length; i++) {',
                  Template.indent([
                    'var oldTag = oldTags[i];',
                    'if(oldTag.parentNode) oldTag.parentNode.removeChild(oldTag);',
                  ]),
                  '}',
                  'oldTags.length = 0;',
                ])}, apply: ${runtimeTemplate.basicFunction('', [
                  'for(var i = 0; i < newTags.length; i++) newTags[i].rel = "stylesheet";',
                  'newTags.length = 0;',
                ])} };`,
              ],
            )}`,
            `${
              RuntimeGlobals.hmrDownloadUpdateHandlers
            }.miniCssK = ${runtimeTemplate.basicFunction(
              'chunkIds, removedChunks, removedModules, promises, applyHandlers, updatedModulesList',
              [
                'applyHandlers.push(applyHandler);',
                `chunkIds.forEach(${runtimeTemplate.basicFunction(
                  'chunkId',
                  [
                    `var href = ${RuntimeGlobals.require}.miniCssF(chunkId);`,
                    `var fullhref = ${RuntimeGlobals.publicPath} + href;`,
                    'var oldTag = findStylesheet(href, fullhref);',
                    'if(!oldTag) return;',
                    `promises.push(new Promise(${runtimeTemplate.basicFunction(
                      'resolve, reject',
                      [
                        `var tag = createStylesheet(chunkId, fullhref, oldTag, ${runtimeTemplate.basicFunction(
                          '',
                          [
                            'tag.as = "style";',
                            'tag.rel = "preload";',
                            'resolve();',
                          ],
                        )}, reject);`,
                        'oldTags.push(oldTag);',
                        'newTags.push(tag);',
                      ],
                    )}));`,
                  ],
                )});`,
              ],
            )}`,
          ])
        : '// no hmr',
    ]);
  }
}
