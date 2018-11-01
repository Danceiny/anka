import path = require('path')
import fs = require('fs-extra')
import ankaConfig from './ankaConfig'
import * as system from './systemConfig'
import resolveConfig from '../utils/resolveConfig'

const customConfig = resolveConfig(['app.json'], system.srcDir)

export default Object.assign({
    pages: [],
    subPackages: [],
    window: {
        navigationBarTitleText: 'Wechat'
    }
    // tabBar: {
    //     list: []
    // },
}, customConfig)
