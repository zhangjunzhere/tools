/****************************************************************************
 Copyright (c) 2008-2010 Ricardo Quesada
 Copyright (c) 2011-2012 cocos2d-x.org
 Copyright (c) 2013-2014 Chukong Technologies Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/



var sceneManifests = ["Manifests/AMTestScene1/project.manifest", "Manifests/AMTestScene2/project.manifest", "Manifests/AMTestScene3/project.manifest"];
var storagePaths = ["JSBTests/AssetsManagerTest/scene1/", "JSBTests/AssetsManagerTest/scene2/", "JSBTests/AssetsManagerTest/scene3"];
var backgroundPaths = ["Images/background1.jpg", "Images/background2.jpg", "Images/background3.png"];

var currentScene = 0;

var AssetsManagerTestLayer = BaseTestLayer.extend({
    _background : null,
    _spritePath : "",

    ctor : function (spritePath) {
        this._super();
        this._spritePath = spritePath;
        cc.loader.resPath = "res/";
    },

    getTitle : function() {
        return "AssetsManagerTest";
    },

    onEnter : function() {
        this._super();
        this._background = new cc.Sprite(this._spritePath);
        this.addChild(this._background, 1);
        this._background.x = cc.winSize.width/2;
        this._background.y = cc.winSize.height/2;
    },

    onExit : function(){
        cc.loader.resPath = "";
        this._super();
    },

    onNextCallback : function () {
        if (currentScene < 2)
        {
            currentScene++;
        }
        else currentScene = 0;
        var scene = new AssetsManagerLoaderScene();
        scene.runThisTest();
    },

    onBackCallback : function () {
        if (currentScene > 0)
        {
            currentScene--;
        }
        else currentScene = 2;
        var scene = new AssetsManagerLoaderScene();
        scene.runThisTest();
    }
});



var AssetsManagerTestScene = TestScene.extend({
    _background : "",

    ctor : function (background) {
        this._super();
        var layer = new AssetsManagerTestLayer(background);
        this.addChild(layer);
    }
});

var __failCount = 0;

var AssetsManagerLoaderScene = TestScene.extend({
    _am : null,
    _progress : null,
    _percent : 0,
    _percentByFile : 0,
    _loadingBar : null,
    _fileLoadingBar : null,

    runThisTest : function () {
        var manifestPath = sceneManifests[currentScene];
        var storagePath = ((jsb.fileUtils ? jsb.fileUtils.getWritablePath() : "/") + storagePaths[currentScene]);
        cc.log("Storage path for this test : " + storagePath);

        var layer = new cc.Layer();
        this.addChild(layer);

        var icon = new cc.Sprite(s_image_icon);
        icon.x = cc.winSize.width/2;
        icon.y = cc.winSize.height/2;
        layer.addChild(icon);

        this._loadingBar = ccui.LoadingBar.create("res/cocosui/sliderProgress.png");
        this._loadingBar.x = cc.visibleRect.center.x;
        this._loadingBar.y = cc.visibleRect.top.y - 40;
        layer.addChild(this._loadingBar);

        this._fileLoadingBar = ccui.LoadingBar.create("res/cocosui/sliderProgress.png");
        this._fileLoadingBar.x = cc.visibleRect.center.x;
        this._fileLoadingBar.y = cc.visibleRect.top.y - 80;
        layer.addChild(this._fileLoadingBar);

        this._am = new jsb.AssetsManager(manifestPath, storagePath);
        this._am.retain();

        if (!this._am.getLocalManifest().isLoaded())
        {
            cc.log("Fail to update assets, step skipped.");
            var scene = new AssetsManagerTestScene(backgroundPaths[currentScene]);
            cc.director.runScene(scene);
        }
        else
        {
            var that = this;
            var listener = new cc.EventListenerAssetsManager(this._am, function(event) {
                var scene;
                switch (event.getEventCode())
                {
                    case cc.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                        cc.log("No local manifest file found, skip assets update.");
                        scene = new AssetsManagerTestScene(backgroundPaths[currentScene]);
                        cc.director.runScene(scene);
                        break;
                    case cc.EventAssetsManager.UPDATE_PROGRESSION:
                        that._percent = event.getPercent();
                        that._percentByFile = event.getPercentByFile();
                        cc.log(that._percent + "%");

                        var msg = event.getMessage();
                        if (msg) {
                            cc.log(msg);
                        }
                        break;
                    case cc.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
                    case cc.EventAssetsManager.ERROR_PARSE_MANIFEST:
                        cc.log("Fail to download manifest file, update skipped.");
                        scene = new AssetsManagerTestScene(backgroundPaths[currentScene]);
                        cc.director.runScene(scene);
                        break;
                    case cc.EventAssetsManager.ALREADY_UP_TO_DATE:
                    case cc.EventAssetsManager.UPDATE_FINISHED:
                        cc.log("Update finished. " + event.getMessage());
                        scene = new AssetsManagerTestScene(backgroundPaths[currentScene]);
                        cc.director.runScene(scene);
                        break;
                    case cc.EventAssetsManager.UPDATE_FAILED:
                        cc.log("Update failed. " + event.getMessage());

                        __failCount ++;
                        if (__failCount < 5)
                        {
                            that._am.downloadFailedAssets();
                        }
                        else
                        {
                            cc.log("Reach maximum fail count, exit update process");
                            __failCount = 0;
                            scene = new AssetsManagerTestScene(backgroundPaths[currentScene]);
                            cc.director.runScene(scene);
                        }
                        break;
                    case cc.EventAssetsManager.ERROR_UPDATING:
                        cc.log("Asset update error: " + event.getAssetId() + ", " + event.getMessage());
                        scene = new AssetsManagerTestScene(backgroundPaths[currentScene]);
                        cc.director.runScene(scene);
                        break;
                    case cc.EventAssetsManager.ERROR_DECOMPRESS:
                        cc.log(event.getMessage());
                        break;
                    default:
                        break;
                }
            });

            cc.eventManager.addListener(listener, 1);

            this._am.update();

            cc.director.runScene(this);
        }

        this.schedule(this.updateProgress, 0.5);
    },

    updateProgress : function () {
        this._loadingBar.setPercent(this._percent);
        this._fileLoadingBar.setPercent(this._percentByFile);
    },

    onExit : function () {
        this._am.release();
        this._super();
    }
});