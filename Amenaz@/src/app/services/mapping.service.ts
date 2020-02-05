import { Injectable } from '@angular/core';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { EnvService } from './env.service';
import { AuthService } from 'src/app/services/auth.service';

import { HttpClient, HttpParams } from '@angular/common/http';
import { from } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { LocationAccuracy } from '@ionic-native/location-accuracy/ngx';

import * as L from 'leaflet';
import { Map, tileLayer, marker, icon, GeoJSON, geoJSON, LatLngExpression, TileLayer, Marker } from 'leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';

import { Events } from '@ionic/angular';

type LayerType = {
  id: number;
  layerName: string;
  queryName: string;
  threadType: string[];
  gJSON: GeoJSON;
  color: string;
  downloaded: boolean;
  description: string;
  datum: string;
  type: string;
  fixed?: boolean;
};

type City = {
  id: number;
  name: string;
  location: LatLngExpression;
  marker: Marker;
  zoomLevel: any;
  layers: LayerType[];
  schemaName: string;
};

interface DBCity {
  id: number;
  nombre: string;
  esquema: string;
  latitud: number;
  longitud: number;
}

@Injectable({
  providedIn: 'root'
})
export class MappingService {
  iconRetinaUrl: string;
  iconUrl: string;
  shadowUrl: string;
  cities: City[] = [];
  privateData: any;

  // searchControProvider: GeoSearchControl;
  searchMarker: any;
  map: Map;
  baseMap: TileLayer;
  threadBaseMap: TileLayer;
  nonThreadMaps: LayerType[] = [];
  seismThreadMaps: LayerType[] = [];
  landSlideThreadMaps: LayerType[] = [];
  floodThreadMaps: LayerType[] = [];

  geoLatitude: number;
  geoLongitude: number;
  geoAccuracy: number;
  geoAddress: string;
  gotGeoposition: boolean;

  searchProvider: OpenStreetMapProvider;
  searchPlaces: any[];
  isSearchMarkerSet: boolean;

  constructor(
    private authService: AuthService,
    private storage: NativeStorage,
    private env: EnvService,
    private androidPermissions: AndroidPermissions,
    private geolocation: Geolocation,
    private locationAccuracy: LocationAccuracy,
    private http: HttpClient,
    public events: Events
  ) {
    // Add OSM Base Map  --  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
    // Arcgis Canvas Light baseMap 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    // 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    this.baseMap = tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      id: 'mapId',
      attribution: 'www.usb.ve MIT License'
    });

    // Fix Leaflet bug with markers
    this.iconRetinaUrl = 'assets/marker-icon-2x.png';
    this.iconUrl = 'assets/marker-icon.png';
    this.shadowUrl = 'assets/marker-shadow.png';
    const iconVar = icon({
      iconRetinaUrl: this.iconRetinaUrl,
      iconUrl: this.iconUrl,
      shadowUrl: this.shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    })

    // Define Cities for App
    this.cities.push({
      id: 0,
      name: 'Visión del Proyecto', location: [8.031, -65.346],
      marker: undefined, zoomLevel: 5, layers: [], schemaName: ''
    });

    this.searchProvider = new OpenStreetMapProvider();
    this.searchPlaces = [];
    this.isSearchMarkerSet = false;
    this.downloadLocations().subscribe(
      (result: DBCity[]) => {
        result.forEach((city: DBCity) => {
          this.cities.push({
            id: city.id,
            name: city.nombre,
            schemaName: city.esquema,
            location: [city.latitud, city.longitud],
            marker: undefined,
            layers: [],
            zoomLevel: 13
          });
        });
      },
      error => {
        console.log('error');
      },
      () => {
        // Add Marker of City with GeoInformation
        this.cities.forEach(city => {
          city.marker = marker(city.location, { icon: iconVar }).bindPopup(city.name).openPopup();
        });
        this.gotGeoposition = false;
        this.getAllMaps();
        this.events.publish('cities-loaded');
      }
    );
  }
  downloadLocations() {
    return from(this.storage.getItem("cities"))
      .pipe(catchError(
        error => this.loadLocations()));
  }
  loadLocations() {
    return this.http.get(this.env.API_URL + 'data/getlocations', {
      headers: {
        Authorization: 'Basic ' + this.authService.token,
        'x-access-token': this.authService.token.token
      }
    })
      .pipe(
        tap(data => {
          this.storage.setItem('cities', data).catch(error => {
            console.log('Error storing Item');
          });
          return data;
        })
      );
  }
  setSearchMarker(x: number, y: number) {
    this.searchMarker = marker([x, y], {
      icon: icon({
        iconRetinaUrl: 'assets/icon/marker-icon-2-2x.png',
        iconUrl: 'assets/icon/marker-icon-2.png',
        shadowUrl: 'assets/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41]
      })
    });
    this.isSearchMarkerSet = true;
  }
  getGeoJSON(schemaName: string, layerName: string) {
    const parameter = new HttpParams()
      .set('cityName', schemaName)
      .set('layerName', layerName);
    return this.http
      .get(this.env.API_URL + 'data/getlayer', {
        headers: {
          Authorization: 'Basic ' + this.authService.token,
          'x-access-token': this.authService.token.token
        },
        params: parameter
      })
      .pipe(
        tap(data => {
          this.storage.setItem(layerName, data).catch(error => {
            console.log('Error storing Item');
          });
          return data;
        })
      );
  }
  getLayer(schemaName: string, layerName: string) {
    return from(this.storage.getItem(layerName)).pipe(catchError(error => this.getGeoJSON(schemaName, layerName)));
  }
  onEachFeature(feature, layer) {
    if (feature.properties) {
      console.log(feature);
      layer.bindPopup(feature.properties);
    }
  }
  downloadLocationsLayers(cityID) {
    return from(this.storage.getItem('ciyLtayers-id' + String(cityID)))
      .pipe(catchError(
        error => this.loadLocationsLayers(cityID)));
  }
  loadLocationsLayers(cityID) {
    const parameter = new HttpParams()
      .set('cityID', cityID);

    return this.http.get(this.env.API_URL + 'data/getlocationslayers', {
      headers: {
        Authorization: 'Basic ' + this.authService.token,
        'x-access-token': this.authService.token.token
      },
      params: parameter
    })
      .pipe(
        tap(data => {
          this.storage.setItem('ciyLtayers-id' + String(cityID), data).catch(error => {
            console.log('Error storing Item');
          });
          return data;
        })
      );
  }
  getAllMaps() {
    var level1 = new L.Icon({
      iconRetinaUrl: 'assets/icon/level-1.png',
      iconUrl: 'assets/icon/level-1.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [12, 13],
      iconAnchor: [12, 13],
      popupAnchor: [1, -34],
      shadowSize: [20, 20]
    });
    var level2 = new L.Icon({
      iconRetinaUrl: 'assets/icon/level-2.png',
      iconUrl: 'assets/icon/level-2.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [12, 13],
      iconAnchor: [12, 13],
      popupAnchor: [1, -34],
      shadowSize: [20, 20]
    });
    var level3 = new L.Icon({
      iconRetinaUrl: 'assets/icon/level-3.png',
      iconUrl: 'assets/icon/level-3.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [12, 13],
      iconAnchor: [12, 13],
      popupAnchor: [1, -34],
      shadowSize: [20, 20]
    });
    var level4 = new L.Icon({
      iconRetinaUrl: 'assets/icon/level-4.png',
      iconUrl: 'assets/icon/level-4.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [12, 13],
      iconAnchor: [12, 13],
      popupAnchor: [1, -34],
      shadowSize: [20, 20]
    });
    var level5 = new L.Icon({
      iconRetinaUrl: 'assets/icon/level-5.png',
      iconUrl: 'assets/icon/level-5.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [12, 13],
      iconAnchor: [12, 13],
      popupAnchor: [1, -34],
      shadowSize: [20, 20]
    });
    var smallIcon = new L.Icon({
      iconRetinaUrl: 'assets/icon/marker-icon-4.png',
      iconUrl: 'assets/icon/marker-icon-4.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [12, 13],
      iconAnchor: [12, 13],
      popupAnchor: [1, -34],
      shadowSize: [20, 20]
    });
    this.cities.forEach(city => {
      this.downloadLocationsLayers(city.id).subscribe(
        result => {
          result.forEach(
            layer => {
              let geoJSONVar: L.GeoJSON;
              geoJSONVar = geoJSON(layer.geojson, {
                style: {
                  color: layer.color,
                  fill: false,
                  weight: 0.30,
                  opacity: 1
                },
                onEachFeature: (feature, layer: L.GeoJSON) => {
                  let message: string = '';
                  let value: string = '';
                  const vals2Omit = [
                    'Espesor', 'Color',
                    'ColorRelleno', 'Opacidad'
                  ];
                  if (feature.properties) {
                    Object.keys(feature.properties).forEach(key => {
                      if (vals2Omit.indexOf(key) == -1) {
                        value = (feature.properties[key] == 'null') ? 'Sin datos' : feature.properties[key];
                        message += '<b>' + key + ':</b>' + '  ' + value + '<br />';
                      }
                    });
                    layer.bindPopup(message);
                    if (feature.properties.Espesor) {
                      layer.setStyle({ weight: feature.properties.Espesor });
                    }
                    if (feature.properties.Color) {
                      layer.setStyle({ color: feature.properties.Color });
                    }
                    if (feature.properties.ColorRelleno) {
                      layer.setStyle({ fillColor: feature.properties.ColorRelleno, fill: true });
                    }
                    if (feature.properties.Opacidad) {
                      layer.setStyle({ fillOpacity: feature.properties.Opacidad });
                    }
                  }
                },
                pointToLayer: (feature, latlng) => {
                  if (feature.properties.Afectacion === '1') {
                    return L.marker(latlng, {
                      icon: level1
                    });
                  } else if (feature.properties.Afectacion === '2') {
                    return L.marker(latlng, {
                      icon: level2
                    });
                  } else if (feature.properties.Afectacion === '3') {
                    return L.marker(latlng, {
                      icon: level3
                    });
                  } else if (feature.properties.Afectacion === '4') {
                    return L.marker(latlng, {
                      icon: level4
                    });
                  } else if (feature.properties.Afectacion === '5') {
                    return L.marker(latlng, {
                      icon: level5
                    });
                  }
                  return L.marker(latlng, {
                    icon: smallIcon
                  });
                }
              });

              let layerThreats = [];
              if (layer.amenazas) {
                layer.amenazas.forEach(amenaza => {
                  layerThreats.push(amenaza.nombre);
                });
              } else {
                layerThreats.push('Ninguna');
              }
              city.layers.push({
                id: layer.id_capa,
                layerName: layer.nombre,
                queryName: layer.nom_tabla,
                color: layer.color,
                description: layer.descripcion,
                gJSON: geoJSONVar,
                datum: layer.datum,
                type: layer.rel_asociacion,
                downloaded: true,
                threadType: layerThreats,
                fixed: layer.fijar_capa
              });
            });
        },
        error => {

        },
        () => {

        }
      );
      // if (city.layers.length > 0) {
      //   city.layers.forEach(layer => {
      //     this.getLayer(city.schemaName, layer.queryName).subscribe(
      //       result => {
      //         layer.gJSON = geoJSON(result, {
      //           style: {
      //             color: layer.color,
      //             weight: 2,
      //             opacity: 0.90
      //           },
      //           onEachFeature: (feature, layer) => {
      //             let message: string = '';
      //             let value: string = '';
      //             if (feature.properties) {
      //               Object.keys(feature.properties).forEach(key => {
      //                 value = (feature.properties[key] == 'null') ? 'Sin datos' : feature.properties[key];
      //                 message += '<b>' + key + ':</b>' + '  ' + value + '<br />';
      //               });
      //               layer.bindPopup(message);
      //             }
      //           },
      //           pointToLayer: (feature, latlng) => {
      //             return L.marker(latlng, {
      //               icon: smallIcon
      //             });
      //           }
      //         });
      //         layer.downloaded = true;
      //       },
      //       error => {
      //         console.log(error);
      //       }
      //     );
      //   });
      // }
    });
    // this.getNonThreadMaps();
    // this.getSeismMaps();
    // this.getLandSlideMaps();
    // this.getFloodThreadMaps();
  }
  checkGPSPermission() {
    this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.ACCESS_COARSE_LOCATION).then(
      result => {
        if (result.hasPermission) {
          this.askToTurnOnGPS();
        } else {
          this.requestGPSPermission();
        }
      },
      err => {
        alert(err);
      }
    );
  }
  requestGPSPermission() {
    this.locationAccuracy.canRequest().then((canRequest: boolean) => {
      if (canRequest) {
        console.log('4');
      } else {
        this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.ACCESS_COARSE_LOCATION).then(
          () => {
            this.askToTurnOnGPS();
          },
          error => {
            alert('requestPermission Error requesting location permissions ' + error);
          }
        );
      }
    });
  }

  askToTurnOnGPS() {
    this.locationAccuracy.request(this.locationAccuracy.REQUEST_PRIORITY_HIGH_ACCURACY).then(
      () => {
        this.getGeolocation();
      },
      error => alert('Error requesting location permissions ' + JSON.stringify(error))
    );
  }

  getGeolocation() {
    this.geolocation
      .getCurrentPosition({ maximumAge: 1000, timeout: 5000, enableHighAccuracy: true })
      .then(
        resp => {
          console.log(resp);
          this.geoLatitude = resp.coords.latitude;
          this.geoLongitude = resp.coords.longitude;
          this.geoAccuracy = resp.coords.accuracy;
          this.gotGeoposition = true;
        },
        err => {
          // alert("error getting location")
          alert('Can not retrieve Location');
        }
      )
      .catch(error => {
        alert('Error getting location' + JSON.stringify(error));
      });
  }
}
