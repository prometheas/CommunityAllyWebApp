﻿namespace Ally
{
    enum PeriodicPaymentFrequency
    {
        Monthly = 50, // Start at number that gives room both before and after
        Quarterly,
        Semiannually,
        Annually
    }


    class PeriodicPayment
    {
        paymentId: number;
        year: number;
        /** The 1-based period index (i.e. 1 = January) */
        period: number;
        isPaid: boolean;
        amount: number;
        paymentDate: Date;
        payerUserId: string;
        wePayCheckoutId: number;
        checkNumber: string;
        notes: string;
        payerNotes: string;
        wePayStatus: string;
        groupId: number;

        isEmptyEntry: boolean = false;
    }


    class AssessmentPayment extends PeriodicPayment
    {
        unitId: number;
    }


    class PayerInfo
    {
        userId: string;
        name: string;

        // Not from the server
        enteredPayments: PeriodicPayment[];
        displayPayments: PeriodicPayment[];
    }


    class FullPaymentHistory
    {
        units: any[];
        payments: PeriodicPayment[];
        specialAssessments: any[];
        payers: PayerInfo[];
    }


    /**
     * The controller for the page to view resident assessment payment history
     */
    export class AssessmentHistoryController implements ng.IController
    {
        static $inject = ["$http", "$location", "SiteInfo", "appCacheService"];
        
        LocalStorageKey_ShowPaymentInfo = "AssessmentHistory_ShowPaymentInfo";
        // The number of pay periods that are visible on the grid
        NumPeriodsVisible = 10;

        pageTitle: string;
        authToken: string;
        units: any[];
        showPaymentInfo: boolean;
        assessmentFrequency: PeriodicPaymentFrequency;
        payPeriodName: string;
        maxPeriodRange: number;
        monthNames: string[];
        periodNames: string[];
        shortPeriodNames: string[];
        startPeriodValue: number;
        startYearValue: number;
        isPeriodicPaymentTrackingEnabled: boolean;
        isLoading: boolean;
        shouldShowCreateSpecialAssessment: boolean = false;
        createSpecialAssessment: any;
        visiblePeriodNames: any[];
        unitPayments: any = {};
        payers: PayerInfo[];
        editPayment: any;
        showRowType: string = "unit";


        /**
        * The constructor for the class
        */
        constructor( private $http: ng.IHttpService, private $location: ng.ILocationService, private siteInfo: Ally.SiteInfoService, private appCacheService:AppCacheService )
        {
        }


        /**
        * Called on each controller after all the controllers on an element have been constructed
        */
        $onInit()
        {
            let isMembershipGroup = AppConfig.appShortName === "neighborhood" || AppConfig.appShortName === "block-club" || AppConfig.appShortName === "pta";
            if( isMembershipGroup )
                this.pageTitle = "Membership Dues Payment History";
            else
                this.pageTitle = "Assessment Payment History";

            this.authToken = window.localStorage.getItem( "ApiAuthToken" );

            if( AppConfig.isChtnSite )
                this.showRowType = "unit";
            else if( isMembershipGroup )
                this.showRowType = "member";
            else
                console.log( "Unhandled app type for payment history: " + AppConfig.appShortName );

            this.units = [
                { name: "A", monthPayments: [1, 2, 3] },
                { name: "B", monthPayments: [1, 2, 3] },
                { name: "C", monthPayments: [1, 2, 3] }
            ];

            // Example
            var payment =
                {
                    paymentId: 0,
                    year: 2014,
                    period: 1, // 1 = January
                    isPaid: false,
                    amount: 1.23,
                    paymentDate: "1/2/14",
                    checkNumber: "123",
                    unitId: 1
                };

            this.showPaymentInfo = window.localStorage[this.LocalStorageKey_ShowPaymentInfo] === "true";

            var PeriodicPaymentFrequency_Monthly = 50;
            var PeriodicPaymentFrequency_Quarterly = 51;
            var PeriodicPaymentFrequency_Semiannually = 52;
            var PeriodicPaymentFrequency_Annually = 53;

            this.assessmentFrequency = <PeriodicPaymentFrequency>this.siteInfo.privateSiteInfo.assessmentFrequency;
            if( isMembershipGroup )
                this.assessmentFrequency = PeriodicPaymentFrequency_Annually;

            // Set the period name
            this.payPeriodName = "month";
            if( this.assessmentFrequency === PeriodicPaymentFrequency_Quarterly )
                this.payPeriodName = "quarter";
            else if( this.assessmentFrequency === PeriodicPaymentFrequency_Semiannually )
                this.payPeriodName = "half-year";
            else if( this.assessmentFrequency === PeriodicPaymentFrequency_Annually )
                this.payPeriodName = "year";


            // Set the range values
            this.maxPeriodRange = 12;
            if( this.assessmentFrequency === PeriodicPaymentFrequency_Quarterly )
                this.maxPeriodRange = 4;
            else if( this.assessmentFrequency === PeriodicPaymentFrequency_Semiannually )
                this.maxPeriodRange = 2;
            else if( this.assessmentFrequency === PeriodicPaymentFrequency_Annually )
                this.maxPeriodRange = 1;

            // Set the label values
            this.monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            var shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            var quarterNames = ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"];
            var shortQuarterNames = ["Q1", "Q2", "Q3", "Q4"];
            var semiannualNames = ["First Half", "Second Half"];
            var shortSemiannualNames = ["1st Half", "2nd Half"];

            this.periodNames = this.monthNames;
            this.shortPeriodNames = shortMonthNames;
            if( this.assessmentFrequency === PeriodicPaymentFrequency_Quarterly )
            {
                this.periodNames = quarterNames;
                this.shortPeriodNames = shortQuarterNames;
            }
            else if( this.assessmentFrequency === PeriodicPaymentFrequency_Semiannually )
            {
                this.periodNames = semiannualNames;
                this.shortPeriodNames = shortSemiannualNames;
            }
            else if( this.assessmentFrequency === PeriodicPaymentFrequency_Annually )
            {
                this.periodNames = [""];
                this.shortPeriodNames = [""];
            }

            // Set the current period
            this.startPeriodValue = new Date().getMonth() + 2;
            this.startYearValue = new Date().getFullYear();
            if( this.assessmentFrequency === PeriodicPaymentFrequency_Quarterly )
            {
                this.startPeriodValue = Math.floor( new Date().getMonth() / 4 ) + 2;
            }
            else if( this.assessmentFrequency === PeriodicPaymentFrequency_Semiannually )
            {
                this.startPeriodValue = Math.floor( new Date().getMonth() / 6 ) + 2;
            }
            else if( this.assessmentFrequency === PeriodicPaymentFrequency_Annually )
            {
                this.startPeriodValue = 1;
                this.startYearValue = new Date().getFullYear() + 1;
            }

            if( this.startPeriodValue > this.maxPeriodRange )
            {
                this.startPeriodValue = 1;
                this.startYearValue += 1;
            }

            this.isPeriodicPaymentTrackingEnabled = this.siteInfo.privateSiteInfo.isPeriodicPaymentTrackingEnabled;

            this.retrievePaymentHistory();
        }


        onChangePeriodicPaymentTracking()
        {
            if( this.isPeriodicPaymentTrackingEnabled === this.siteInfo.privateSiteInfo.isPeriodicPaymentTrackingEnabled )
                return;

            // If the user is enabling the tracking then make sure all units have a payment entered
            if( this.isPeriodicPaymentTrackingEnabled )
            {
                //if( Object.keys(vm.unitPayments).length !== SiteInfo.privateSiteInfo.NumUnits )
                //{
                //    vm.isPeriodicPaymentTrackingEnabled = false;
                //    alert( "You must specify this most recent payment for every unit." );
                //    return;
                //}
            }

            this.siteInfo.privateSiteInfo.isPeriodicPaymentTrackingEnabled = this.isPeriodicPaymentTrackingEnabled;

            this.isLoading = true;

            var innerThis = this;
            this.$http.put( "/api/Association/updatePeriodicPaymentTracking?isPeriodicPaymentTrackingEnabled=" + this.isPeriodicPaymentTrackingEnabled, null ).then( function()
            {
                innerThis.isLoading = false;
            }, function()
            {
                alert( "Failed to update the payment tracking" );
                innerThis.isLoading = false;
            } );
        }

        
        /**
         * Add in entries to the payments array so every period has an entry
         */
        fillInEmptyPaymentsForUnit( unit: any )
        {
            var defaultOwnerUserId = ( unit.owners !== null && unit.owners.length > 0 ) ? unit.owners[0].userId : null;

            var sortedPayments = [];
            var curPeriod = this.startPeriodValue;
            var curYearValue = this.startYearValue;
            for( var periodIndex = 0; periodIndex < this.NumPeriodsVisible; ++periodIndex )
            {
                if( curPeriod < 1 )
                {
                    curPeriod = this.maxPeriodRange;
                    --curYearValue;
                }

                var curPeriodPayment = _.find( unit.allPayments, function( p:any ) { return p.period === curPeriod && p.year === curYearValue; } );

                if( curPeriodPayment === undefined || curPeriodPayment.isEmptyEntry )
                {
                    curPeriodPayment = {
                        isPaid: false,
                        period: curPeriod,
                        year: curYearValue,
                        amount: unit.assessment,
                        payerUserId: defaultOwnerUserId,
                        paymentDate: new Date(),
                        isEmptyEntry: true
                    };
                }

                sortedPayments.push( curPeriodPayment );

                // curPeriod goes 1-vm.maxPeriodRange
                curPeriod--;
            }

            return sortedPayments;
        }


        /**
         * Add in entries to the payments array so every period has an entry
         */
        fillInEmptyPaymentsForMember( member: PayerInfo )
        {
            var sortedPayments = [];
            var curPeriod = this.startPeriodValue;
            var curYearValue = this.startYearValue;
            for( var periodIndex = 0; periodIndex < this.NumPeriodsVisible; ++periodIndex )
            {
                if( curPeriod < 1 )
                {
                    curPeriod = this.maxPeriodRange;
                    --curYearValue;
                }

                var curPeriodPayment: PeriodicPayment = _.find( member.enteredPayments, p => p.period === curPeriod && p.year === curYearValue );

                if( curPeriodPayment === undefined || curPeriodPayment.isEmptyEntry )
                {
                    curPeriodPayment = {
                        isPaid: false,
                        paymentId: null,
                        period: curPeriod,
                        year: curYearValue,
                        amount: 0,
                        payerUserId: member.userId,
                        paymentDate: new Date(),
                        isEmptyEntry: true,
                        wePayCheckoutId: null,
                        checkNumber: null,
                        notes: null,
                        payerNotes: null,
                        wePayStatus: null,
                        groupId: null
                    };
                }

                sortedPayments.push( curPeriodPayment );

                // curPeriod goes 1-vm.maxPeriodRange
                curPeriod--;
            }

            return sortedPayments;
        }


        viewWePayDetails( wePayCheckoutId: string )
        {
            this.appCacheService.set( "hwpid", wePayCheckoutId );
            this.$location.path( "/ManagePayments" );
        }

        
        /**
         * Create a special assessment entry
         */
        addSpecialAssessment()
        {
            // JS is 0 based month plus Angular uses strings so move to 1-based integer for the server
            this.createSpecialAssessment = parseInt( this.createSpecialAssessment ) + 1;

            // Create the special assessment
            this.isLoading = true;

            var innerThis = this;
            this.$http.post( "/api/PaymentHistory/SpecialAssessment", this.createSpecialAssessment ).then( function()
            {
                innerThis.isLoading = false;
                innerThis.shouldShowCreateSpecialAssessment = false;

                innerThis.retrievePaymentHistory();

            }, function( httpResponse:ng.IHttpPromiseCallbackArg<Ally.ExceptionResult> )
            {
                innerThis.isLoading = false;

                var errorMessage = httpResponse.data.exceptionMessage ? httpResponse.data.exceptionMessage : httpResponse.data;
                alert( "Failed to add special assessment: " + errorMessage );
            } );
        }

        
        /**
         * Display the modal to create special assessments
         */
        showCreateSpecialAssessment()
        {
            this.shouldShowCreateSpecialAssessment = true;

            this.createSpecialAssessment = {
                year: new Date().getFullYear(),
                month: new Date().getMonth().toString(),
                notes: "",
                amount: null
            };
        }

        
        /**
         * Go back a few pay periods
         */
        browsePast()
        {
            this.startPeriodValue = this.startPeriodValue - 6;

            while( this.startPeriodValue < 1 )
            {
                this.startPeriodValue = this.maxPeriodRange + this.startPeriodValue;
                --this.startYearValue;
            }

            this.displayPaymentsForRange( this.startYearValue, this.startPeriodValue );
        }


        /**
         * Go ahead a few pay periods
         */
        browseFuture()
        {
            this.startPeriodValue = this.startPeriodValue + 6;

            while( this.startPeriodValue > this.maxPeriodRange )
            {
                this.startPeriodValue -= this.maxPeriodRange;
                ++this.startYearValue;
            }

            this.displayPaymentsForRange( this.startYearValue, this.startPeriodValue );
        }


        /**
         * Populate the display for a date range
         */
        displayPaymentsForRange( startYear:number, startPeriod:number )
        {
            this.startYearValue = startYear;
            this.startPeriodValue = startPeriod;

            this.visiblePeriodNames = [];
            var year = this.startYearValue;

            var currentPeriod = this.startPeriodValue;
            for( var columnIndex = 0; columnIndex < this.NumPeriodsVisible; ++columnIndex )
            {
                if( currentPeriod < 1 )
                {
                    currentPeriod = this.maxPeriodRange;
                    --year;
                }

                var headerName = this.shortPeriodNames[currentPeriod - 1];
                if( currentPeriod === 1 || currentPeriod === this.maxPeriodRange )
                    headerName += " " + year;

                this.visiblePeriodNames.push( {
                    name: headerName,
                    periodIndex: currentPeriod,
                    arrayIndex: columnIndex,
                    year: year
                } );

                --currentPeriod;
            }

            // Make sure every visible period has an valid entry object
            if( AppConfig.appShortName === "pta" )
                _.each( this.payers, payer => payer.displayPayments = this.fillInEmptyPaymentsForMember( payer ) );
            else
                _.each( this.unitPayments, ( unit: any ) => unit.payments = this.fillInEmptyPaymentsForUnit( unit ) );
        }


        /**
         * Populate the payment grid
         */
        retrievePaymentHistory()
        {
            this.isLoading = true;

            var innerThis = this;
            this.$http.get( "/api/PaymentHistory?oldestDate=" ).then( ( httpResponse: ng.IHttpPromiseCallbackArg<FullPaymentHistory> ) =>
            {
                var paymentInfo = httpResponse.data;
                
                // Build the map of unit ID to unit information
                innerThis.unitPayments = {};
                _.each( paymentInfo.units, function( unit:any )
                {
                    innerThis.unitPayments[unit.unitId] = unit;

                    // Only take the first two owners for now
                    innerThis.unitPayments[unit.unitId].displayOwners = _.first( unit.owners, 2 );
                    while( innerThis.unitPayments[unit.unitId].displayOwners.length < 2 )
                        innerThis.unitPayments[unit.unitId].displayOwners.push( { name: "" } );

                    innerThis.unitPayments[unit.unitId].payments = [];
                } );

                // Add the payment information to the units
                if( AppConfig.appShortName === "pta" )
                {
                    _.each( httpResponse.data.payers, ( payer ) =>
                    {
                        payer.enteredPayments = _.filter( paymentInfo.payments, p => p.payerUserId === payer.userId );
                    } );
                }

                // Add the payment information to the units
                _.each( paymentInfo.payments, function( payment: AssessmentPayment )
                {
                    if( innerThis.unitPayments[payment.unitId] )
                        innerThis.unitPayments[payment.unitId].payments.push( payment );
                } );

                // Store all of the payments rather than just what is visible
                _.each( paymentInfo.units, function( unit:any )
                {
                    unit.allPayments = unit.payments;
                } );
                
                // Sort the units by name
                var sortedUnits = [];
                for( var key in innerThis.unitPayments )
                    sortedUnits.push( innerThis.unitPayments[key] );
                innerThis.unitPayments = _.sortBy( sortedUnits, function( unit:any ) { return unit.name; } );

                innerThis.payers = _.sortBy( paymentInfo.payers, function( payer:any ) { return payer.name; } );

                innerThis.displayPaymentsForRange( innerThis.startYearValue, innerThis.startPeriodValue );

                innerThis.isLoading = false;

            }, ( response: ng.IHttpPromiseCallbackArg<ExceptionResult> ) =>
            {
                this.isLoading = false;
                alert( "Failed to retrieve payment history: " + response.data.exceptionMessage );
            } );
        }

        /**
         * Get the amount paid by all units in a pay period
         */
        getPaymentSumForPayPeriod( periodIndex:number )
        {
            let sum = 0;

            if( AppConfig.isChtnSite )
            {
                let unitIds: string[] = _.keys( this.unitPayments );

                for( let i = 0; i < unitIds.length; ++i )
                {
                    let unitId = unitIds[i];

                    let paymentInfo = this.unitPayments[unitId].payments[periodIndex];
                    if( paymentInfo && paymentInfo.isPaid )
                        sum += paymentInfo.amount;
                }
            }
            else
            {
                for( let i = 0; i < this.payers.length; ++i )
                {
                    let paymentInfo = this.payers[i].displayPayments[periodIndex];
                    if( paymentInfo && paymentInfo.isPaid )
                        sum += paymentInfo.amount;
                }
            }

            return sum;
        }


        /**
         * Occurs when the user toggles whether or not to show payment info
         */
        onshowPaymentInfo()
        {
            window.localStorage[this.LocalStorageKey_ShowPaymentInfo] = this.showPaymentInfo;
        }


        /**
         * Occurs when the user clicks a date cell
         */
        onUnitPaymentCellClick( unit: any, periodPayment: any )
        {
            periodPayment.unitId = unit.unitId;

            this.editPayment = {
                unit: unit,
                payment: _.clone( periodPayment ), // Make a copy of the object so we can edit it without editing the grid
                periodName: this.periodNames[periodPayment.period - 1],
                filteredPayers: _.filter( this.payers, function( payer:any )
                {
                    return !_.some( unit.owners, function( owner:any )
                    {
                        return owner.userId === payer.userId;
                    } );
                } )
            };

            setTimeout( function() { $( "#paid-amount-textbox" ).focus(); }, 10 );
        }


        /**
         * Occurs when the user clicks a date cell
         */
        onMemberPaymentCellClick( payer: PayerInfo, periodPayment: PeriodicPayment )
        {
            periodPayment.payerUserId = payer.userId;

            this.editPayment = {
                unit: null,
                payment: _.clone( periodPayment ), // Make a copy of the object so we can edit it without editing the grid
                periodName: this.periodNames[periodPayment.period - 1],
                filteredPayers: null
            };

            setTimeout( function() { $( "#paid-amount-textbox" ).focus(); }, 10 );
        }


        onSavePayment = function()
        {
            var innerThis = this;

            var onSave = function()
            {
                innerThis.isSavingPayment = false;

                innerThis.editPayment = null;
                innerThis.retrievePaymentHistory();
            };

            var onError = function( httpResponse:ng.IHttpPromiseCallbackArg<any> )
            {
                innerThis.isSavingPayment = false;

                alert( httpResponse.data.message );
                innerThis.editPayment = null;
            };

            this.isSavingPayment = true;

            if( this.editPayment.payment.paymentId )
            {
                analytics.track( "editAssessmentHistoryPayment" );
                this.$http.put( "/api/PaymentHistory", this.editPayment.payment ).then( onSave, onError );
            }
            else
            {
                analytics.track( "addAssessmentHistoryPayment" );
                this.$http.post( "/api/PaymentHistory", this.editPayment.payment ).then( onSave, onError );
            }
        }
    }
}


CA.angularApp.component( "assessmentHistory", {
    templateUrl: "/ngApp/chtn/manager/assessment-history.html",
    controller: Ally.AssessmentHistoryController
} );
