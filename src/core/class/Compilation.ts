import {
    ParserInjection
} from './Injection'
import File from './File'
import config from '../../config'
import Compiler from './Compiler'
import * as utils from '../../utils'

/**
 * A compilation task
 */
export default class Compilation {
    config: object
    readonly compiler: Compiler
    id: number        // Unique，for each Compilation
    file: File
    sourceFile: string
    destroyed: boolean

    constructor (file: File | string, conf: object, compiler: Compiler) {
        this.compiler = compiler
        this.config = conf
        this.id = Compiler.compilationId++

        if (file instanceof File) {
            this.file = file
            this.sourceFile = file.sourceFile
        } else {
            this.sourceFile = file
        }

        this.enroll()
    }

    async run (): Promise<void> {
        await this.loadFile()
        await this.invokeParsers()
        await this.compile()
    }

    async loadFile (): Promise<void> {
        if (this.destroyed) return

        await this.compiler.emit('before-load-file', this)
        if (!(this.file instanceof File)) {
            this.file = await utils.createFile(this.sourceFile)
        }

        await this.compiler.emit('after-load-file', this)
    }

    async invokeParsers (): Promise<void> {
        if (this.destroyed) return

        const file = this.file
        const parsers = <Parser[]>this.compiler.parsers.filter((matchers: Matcher) => {
            return matchers.match.test(file.targetFile)
        }).map((matchers: Matcher) => {
            return matchers.parsers
        }).reduce((prev, next) => {
            return prev.concat(next)
        }, [])
        const tasks = parsers.map(parser => {
            return utils.asyncFunctionWrapper(parser)
        })

        await this.compiler.emit('before-parse', this)
        await utils.callPromiseInChain(tasks, file, this)
        await this.compiler.emit('after-parse', this)
    }

    async compile (): Promise<void> {
        if (this.destroyed) return

        // Invoke ExtractDependencyPlugin.
        await this.compiler.emit('before-compile', this)
        // Do something else.
        await this.compiler.emit('after-compile', this)
        utils.logger.info('Compile',  this.file.sourceFile.replace(config.cwd, ''))
    }

    /**
     * Register on Compiler and destroy the previous one if conflict arises.
     */
    enroll (): void {
        const oldCompilation = Compiler.compilationPool.get(this.sourceFile)

        if (oldCompilation) {
            if (config.ankaConfig.debug) console.log('Destroy Compilation', oldCompilation.id, oldCompilation.sourceFile)

            oldCompilation.destroy()
        }
        Compiler.compilationPool.set(this.sourceFile, this)
    }

    /**
     * Unregister themselves from Compiler.
     */
    destroy (): void {
        this.destroyed = true
        Compiler.compilationPool.delete(this.sourceFile)
    }
}
