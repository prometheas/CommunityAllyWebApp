namespace Ally
{
    export class BaseSiteSettings
    {
        backgroundImageFiles: string[];
        bgImageFileName: string;
        siteTitle: string;
        fullName: string;
        welcomeMessage: string;
    }


    /**
     * Represents settings for a Condo, HOA, or Neighborhood Ally site
     */
    export class ChtnSiteSettings extends BaseSiteSettings
    {
        allowOwnersToSendEmail: boolean;
        allowRentersToSendEmail: boolean;
        homeRightColumnType: string;
        rentersCanViewDocs: boolean;
        canHideContactInfo: boolean;
        isDiscussionEmailGroupEnabled: boolean;
        ptaUnitId: number;
    }


    /**
     * The controller for the page to view group site settings
     */
    export class ChtnSettingsController implements ng.IController
    {
        static $inject = ["$http", "SiteInfo", "$timeout", "$scope"];

        settings: ChtnSiteSettings = new ChtnSiteSettings();
        originalSettings: ChtnSiteSettings = new ChtnSiteSettings();
        defaultBGImage: string;
        showQaButton: boolean;
        loginImageUrl: string;
        isLoading: boolean;
        showRightColumnSetting: boolean = true;
        showLocalNewsSetting: boolean = false;
        isPta: boolean = false;


        /**
         * The constructor for the class
         */
        constructor( private $http: ng.IHttpService, private siteInfo: Ally.SiteInfoService, private $timeout: ng.ITimeoutService, private $scope: ng.IScope )
        {
        }


        /**
         * Called on each controller after all the controllers on an element have been constructed
         */
        $onInit()
        {
            this.defaultBGImage = $( document.documentElement ).css( "background-image" );

            this.showQaButton = this.siteInfo.userInfo.emailAddress === "president@mycondoally.com";

            this.loginImageUrl = this.siteInfo.publicSiteInfo.loginImageUrl;

            this.showRightColumnSetting = this.siteInfo.privateSiteInfo.creationDate < Ally.SiteInfoService.AlwaysDiscussDate;
            this.showLocalNewsSetting = !this.showRightColumnSetting;

            this.isPta = AppConfig.appShortName === "pta";


            // Hook up the file upload control after everything is loaded and setup
            this.$timeout( () => this.hookUpLoginImageUpload(), 200 );

            this.refreshData();
        }


        /**
         * Populate the page from the server
         */
        refreshData()
        {
            this.isLoading = true;
            
            this.$http.get( "/api/Settings" ).then( ( response: ng.IHttpPromiseCallbackArg<ChtnSiteSettings> ) =>
            {
                this.isLoading = false;
                this.settings = response.data;
                this.originalSettings = _.clone( response.data );
            } );
        }


        /**
         * Clear the login image
         */
        removeLoginImage()
        {
            analytics.track( "clearLoginImage" );

            this.isLoading = true;

            var innerThis = this;
            this.$http.get( "/api/Settings/ClearLoginImage" ).then( function()
            {
                innerThis.isLoading = false;
                innerThis.siteInfo.publicSiteInfo.loginImageUrl = "";
                innerThis.loginImageUrl = "";                

            }, function( httpResponse: ng.IHttpPromiseCallbackArg<Ally.ExceptionResult> )
            {
                innerThis.isLoading = false;
                alert( "Failed to remove loading image: " + httpResponse.data.exceptionMessage );
            } );
        }


        /**
         * Save all of the settings
         */
        saveAllSettings()
        {
            analytics.track( "editSettings" );

            this.isLoading = true;
            
            this.$http.put( "/api/Settings", this.settings ).then( () =>
            {
                this.isLoading = false;

                // Update the locally-stored values
                this.siteInfo.privateSiteInfo.homeRightColumnType = this.settings.homeRightColumnType;
                this.siteInfo.privateSiteInfo.welcomeMessage = this.settings.welcomeMessage;
                this.siteInfo.privateSiteInfo.ptaUnitId = this.settings.ptaUnitId;
                this.siteInfo.privateSiteInfo.homeRightColumnType = this.settings.homeRightColumnType;

                var didChangeFullName = this.settings.fullName !== this.originalSettings.fullName;

                // Reload the page to show the page title has changed
                if( didChangeFullName )
                    location.reload();

            }, ( response: ng.IHttpPromiseCallbackArg<ExceptionResult> ) =>
            {
                this.isLoading = false;
                alert( "Failed to save: " + response.data );
            } );
        }


        /**
         * Occurs when the user clicks a new background image
         */
        onImageClick( bgImage: string )
        {
            this.settings.bgImageFileName = bgImage;
            //SettingsJS._defaultBG = bgImage;

            var innerThis = this;
            this.$http.put( "/api/Settings", { BGImageFileName: this.settings.bgImageFileName } ).then( function()
            {
                $( ".test-bg-image" ).removeClass( "test-bg-image-selected" );

                //$( "img[src='" + $rootScope.bgImagePath + bgImage + "']" ).addClass( "test-bg-image-selected" );

                innerThis.isLoading = false;

            }, ( response: ng.IHttpPromiseCallbackArg<ExceptionResult> ) =>
            {
                this.isLoading = false;
                alert( "Failed to save: " + response.data );
            } );
        }


        onImageHoverOver( bgImage: string )
        {
            //$( document.documentElement ).css( "background-image", "url(" + $rootScope.bgImagePath + bgImage + ")" );
        }


        onImageHoverOut()
        {
            //if( typeof ( this.settings.bgImageFileName ) === "string" && this.settings.bgImageFileName.length > 0 )
            //    $( document.documentElement ).css( "background-image", "url(" + $rootScope.bgImagePath + this.settings.bgImageFileName + ")" );
            //else
            //    $( document.documentElement ).css( "background-image", this.defaultBGImage );
        }


        onQaDeleteSite()
        {
            this.$http.get( "/api/QA/DeleteThisAssociation" ).then( function()
            {
                location.reload();
            }, function( httpResponse: ng.IHttpPromiseCallbackArg<Ally.ExceptionResult> )
                {
                    alert( "Failed to delete site: " + httpResponse.data.exceptionMessage );
                } );
        }


        /**
         * Hooked up the login image JQuery upload control
         */
        hookUpLoginImageUpload()
        {
            var innerThis = this;

            $( function()
            {
                $( '#JQLoginImageFileUploader' ).fileupload( {
                    autoUpload: true,
                    add: function( e: any, data: any )
                    {
                        innerThis.$scope.$apply( function()
                        {
                            innerThis.isLoading = true;
                        } );

                        analytics.track( "setLoginImage" );

                        $( "#FileUploadProgressContainer" ).show();
                        data.url = "api/DocumentUpload/LoginImage?ApiAuthToken=" + innerThis.siteInfo.authToken;

                        var xhr = data.submit();
                        xhr.done( function( result: any )
                        {
                            innerThis.$scope.$apply( function()
                            {
                                innerThis.isLoading = false;
                                innerThis.loginImageUrl = result.newUrl + "?cacheBreaker=" + new Date().getTime();
                                innerThis.siteInfo.publicSiteInfo.loginImageUrl = innerThis.loginImageUrl;
                            } );

                            $( "#FileUploadProgressContainer" ).hide();
                        } );
                    },
                    progressall: function( e: any, data: any )
                    {
                        var progress = Math.floor(( data.loaded * 100 ) / data.total );
                        $( '#FileUploadProgressBar' ).css( 'width', progress + '%' );

                        if( progress === 100 )
                            $( "#FileUploadProgressLabel" ).text( "Finalizing Upload..." );
                        else
                            $( "#FileUploadProgressLabel" ).text( progress + "%" );
                    }
                } );
            } );
        }
    }
}


CA.angularApp.component( "chtnSettings", {
    templateUrl: "/ngApp/chtn/manager/settings.html",
    controller: Ally.ChtnSettingsController
} );