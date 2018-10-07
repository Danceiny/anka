import path from 'path'
import File from './File'
import log from '../util/log'
import babel from 'babel-core'
import system from '../config'
import traverse from 'babel-traverse'
import { NpmDependence } from './NpmDependence'
import { npmDependenceCache } from '../util/cache'
import { ACTIONS, FILE_TYPES } from '../config/types'

export default class ScriptFile extends File {
    constructor (fileConfig) {
        super(fileConfig)
        this.type = FILE_TYPES.SCRIPT
        this.localDependencies = {}
        this.npmDependencies = {}
    }

    compile () {
        this.traverse()
        this.compiledContent = babel.transformFromAst(this.$ast).code
        this.updateNpmDependenceCache()
        this.save()
        log.info(ACTIONS.COMPILE, this.src)
    }

    traverse () {
        this.updateContent()
        this.$ast = babel.transform(this.originalContent, {
            ast: true,
            babelrc: false,
            ...system.babelConfig.options
        }).ast

        traverse(this.$ast, {
            enter: astNode => {
                const node = astNode.node
                if (astNode.isImportDeclaration()) {
                    const dependence = node.source.value
                    if (this.isNpmDependence(dependence)) {
                        const npmDependence = new NpmDependence(dependence)
                        node.source.value = this.resolveNpmDependence(npmDependence)
                    } else if (this.isLocalDependence(dependence)) {
                        this.resolveLocalDependence(dependence)
                    }
                } else if (
                    astNode.isCallExpression() &&
                    node.callee.name === 'require' &&
                    node.arguments[0] &&
                    node.arguments[0].value
                ) {
                    const dependence = node.arguments[0].value
                    if (this.isNpmDependence(dependence)) {
                        const npmDependence = new NpmDependence(dependence)
                        node.arguments[0].value = this.resolveNpmDependence(npmDependence)
                    } else if (this.isLocalDependence(dependence)) {
                        this.resolveLocalDependence(dependence)
                    }
                }
            }
        })
    }

    resolveNpmDependence (npmDependence) {
        const dist = path.relative(this.distDir, npmDependence.dist)
        this.npmDependencies[npmDependence.name] = npmDependence
        return npmDependence.pkgInfo ? path.join(dist, npmDependence.pkgInfo.main) : dist
    }

    resolveLocalDependence (localDependence) {
        this.localDependencies[localDependence.dist] = localDependence
    }

    updateNpmDependenceCache () {
        Object.values(this.npmDependencies).forEach(npmDependence => {
            if (!npmDependenceCache.find(npmDependence.name)) {
                npmDependenceCache.set(npmDependence.name, npmDependence)
                npmDependence.compile()
            }
        })
    }
}
