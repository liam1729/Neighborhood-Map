var map;
var markers = [];
var sidebarOpen = false;

/**
 * @description Represents a place. 
 * @constructor
 * @param {String} title 
 * @param {Dictionary} location 
 */
var Place = function (title, location) {
    this.title = title;
    this.location = location;
    this.id = 0;
    this.description = "";
    this.wikiUrl = "";
    this.currentSelection = ko.observable(false);
}

var places = [new Place("Port Lympne Wild Animal Park", { lat: 51.078336, lng: 0.9985535 }),
              new Place("Bedgebury Forest", { lat: 51.0725744, lng: 0.4454053 }),
              new Place("Leeds Castle", { lat: 51.2489929, lng: 0.6282762 }),
              new Place("Canterbury Cathedral", { lat: 51.2798004, lng: 1.0806111 }),
              new Place("Chatham Historic Dockyard", { lat: 51.3968622, lng: 0.530843 })]


var ViewModel = function () {
    var self = this;
    self.largeInfoWindow = new google.maps.InfoWindow({ maxWidth: 200 });
    self.squery = ko.observable("");
    self.contentCSS = ko.observable("content-large");
    self.sidebarCSS = ko.observable("sidebar-closed");
    self.showMenuButton = ko.observable("show-button");
    self.markerPlaces = ko.observableArray(places);
    self.currentPlace;

    /**
     * @description Initialise all the markers on the map and set a callback for when the browser size changes.
     */
    self.init = function () {
        markers = [];
        for (var i = 0; i < places.length; i++) {
            var location = places[i].location;
            var title = places[i].title;

            var marker = new google.maps.Marker({
                map: map,
                position: location,
                title: title,
                animation: google.maps.Animation.Drop,
                id: i
            });

            places[i].id = i;
            markers.push(marker);

            // Add a click listenter to bounce the marker, show the info window
            // and select the place in the list.
            marker.addListener('click', (function (index, cmarker) {
                return function () {
                    cmarker.setAnimation(google.maps.Animation.BOUNCE);
                    setTimeout(function () {
                        cmarker.setAnimation(null);
                    }, 700);

                    if (self.currentPlace) {
                        self.currentPlace.currentSelection(false);
                    }

                    self.currentPlace = self.markerPlaces()[index];
                    self.currentPlace.currentSelection(true);
                    self.populateInfoWindow(this, self.largeInfoWindow);
                }
            })(i, marker));
        }

        // Set a callback to update the page elements when the size of the browser changes.
        if (matchMedia) {
            var matchQuery = window.matchMedia("(max-width: 865px)");
            matchQuery.addListener(self.widthChange);
            self.widthChange(matchQuery);
        }
    }

    /**
     * @description Updates the CSS classes for the sidebar and content when the browser size changes.
     * @param {object} matchQuery
     */
    self.widthChange = function (matchQuery) {
        if (sidebarOpen) {
            if (matchQuery.matches) {
                self.contentCSS("content-small");
                self.sidebarCSS("sidebar-large");
            } else {
                self.contentCSS("content-medium");
                self.sidebarCSS("sidebar-small");
            }
        }
    };

    /**
     * @description Opens the sidebar, checks the width of the browser to apply the correct css.
     */
    self.openNav = function () {
        sidebarOpen = true;
        var matchQuery = window.matchMedia("(max-width: 865px)");
        if (matchQuery.matches) {
            self.contentCSS("content-small");
            self.sidebarCSS("sidebar-large");
        } else {
            self.contentCSS("content-medium");
            self.sidebarCSS("sidebar-small");
        }

        self.showMenuButton("hide-button");
    };

    /**
     * @description Closes the navigation bar and changes the CSS classes to refit the content.
     */
    self.closeNav = function () {
        sidebarOpen = false;
        self.contentCSS("content-large");
        self.sidebarCSS("sidebar-closed");
        self.showMenuButton("show-button");
    };

    /**
     * @description Selects a marker and shows the info window on the map with an animated bounce.
     * @param {object} place
     * @param {object} event 
     */
    self.selectMarker = function (place, event) {
        if (self.currentPlace) {
            self.currentPlace.currentSelection(false);
        }

        place.currentSelection(true);
        self.currentPlace = place;

        currentMarker = markers[place.id];
        currentMarker.setAnimation(google.maps.Animation.BOUNCE);

        setTimeout((function (currMarker) {
            return function () {
                currMarker.setAnimation(null);
            };
        })(currentMarker), 700);

        self.populateInfoWindow(currentMarker, self.largeInfoWindow);
    };

    /** 
     * @description Searches the places for any that matches the search query.
    */
    self.markerPlaces = ko.dependentObservable(function () {
        // Find all places that match the search query.
        var search = self.squery().toLowerCase();
        searchedPlaces = ko.utils.arrayFilter(places, function (place) {
            return place.title.toLowerCase().indexOf(search) >= 0;
        });

        // Close the current info window.
        self.largeInfoWindow.close();
        self.largeInfoWindow.marker = null;

        // Hide all map markers.
        for (var i = 0; i < markers.length; i++) {
            markers[i].setMap(null);
        }

        // Place all the map markers that are in the current search.
        for (var i = 0; i < searchedPlaces.length; i++) {
            var searchPlace = searchedPlaces[i];
            for (var j = 0; j < markers.length; j++) {
                if (searchPlace.id == markers[j].id) {
                    markers[j].setMap(map);
                }
            }
        }

        if (self.currentPlace) {
            self.currentPlace.currentSelection(false);
        }

        return searchedPlaces;

    }, self)

    /**
     * @description Opens a info window for a marker, gets url and description from the wikipedia api.
     * @param {object} marker 
     * @param {object} infoWindow 
     */
    self.populateInfoWindow = function (marker, infoWindow) {
        if (infoWindow.marker != marker) {
            var wikiRestUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" + marker.title;
            var wikiUrl = "http://en.wikipedia.org/w/api.php?action=opensearch&search=" + marker.title + "&format=json&callback=wikiCallback";
            var placeObject = places[marker.id];

            // Get a description of the place from the wikimedia api and store it in the correct places object.
            if (placeObject.description == "") {
                $.ajax({
                    type: "GET",
                    dataType: "json",
                    url: wikiRestUrl,
                    success: function (response) {
                        places[marker.id].description = response.extract.substring(0, 140);
                        infoWindow.setContent('<div class="info-window"><h3>' + marker.title + '</h3>' + '<p>' +
                            places[marker.id].description + '...</p><p><a target="_blank" href="' + places[marker.id].wikiUrl + '">Read more on Wikipedia</a></p></div>');
                    },
                    onerror: function (response) {
                        infoWindow.setContent('<div class="info-window"><h3>' + marker.title + '</h3>' +
                            '<p>There was a problem accessing the wikipedia servers! Please check your internet connection.');
                    }
                });
            }

            // Get a wikipedia url for the marker place and store it in the corrent places object.
            if (placeObject.wikiUrl == "") {
                $.ajax({
                    url: wikiUrl,
                    dataType: "jsonp",
                    success: function (response) {
                        places[marker.id].wikiUrl = response[3][0];
                        infoWindow.setContent('<div class="info-window"><h3>' + marker.title + '</h3>' + '<p>' +
                            places[marker.id].description + '...</p><p><a target="_blank" href="' + places[marker.id].wikiUrl + '">Read more on Wikipedia</a></p></div>');
                    },
                    onerror: function (response) {
                        infoWindow.setContent('<div class="info-window"><h3>' + marker.title + '</h3>' +
                            '<p>There was a problem accessing the wikipedia servers! Please check your internet connection.');
                    }
                });
            }

            // Update the info window and open it.
            infoWindow.marker = marker;
            infoWindow.setContent('<div class="info-window"><h3>' + marker.title + '</h3>' + '<p>' +
                places[marker.id].description + '...</p><p><a target="_blank" href="' + places[marker.id].wikiUrl + '">Read more on Wikipedia</a></p></div>');
            infoWindow.open(map, marker);
            infoWindow.addListener('closeclick', function () {
                infoWindow.marker = null;
                infoWindow.close();

                if (self.currentPlace) {
                    self.currentPlace.currentSelection(false);
                }
            });
        }
    }

    self.init();
}

/** 
 * @description Show alert if the google maps api has failed to load.
*/
function googleError() {
    alert("Connection to google maps has failed! Check your internet Connection.");
}

/** 
 * Runs after the google maps api has loaded, creates a new map and view model.
*/
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 51.2045149, lng: 0.726728 },
        zoom: 9
    });

    ko.applyBindings(new ViewModel());
}

