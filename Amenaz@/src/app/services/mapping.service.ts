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

import { Map, tileLayer, marker, icon, GeoJSON, geoJSON, LatLngExpression, TileLayer, Marker } from 'leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';

type LayerType = {
  layerName: string;
  queryName: string;
  threadType: string;
  gJSON: GeoJSON;
  color: string;
  downloaded: boolean;
};

type City = {
  name: string;
  location: LatLngExpression;
  marker: Marker;
  zoomLevel: any;
  layers: LayerType[];
  schemaName: string;
};

@Injectable({
  providedIn: 'root'
})
export class MappingService {
  iconRetinaUrl: string;
  iconUrl: string;
  shadowUrl: string;
  cities: City[] = [];

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
    private http: HttpClient
  ) {
    // Add OSM Base Map  --  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
    // 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    this.baseMap = tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
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
      name: 'Visión del Proyecto', location: [8.031, -65.346],
      marker: undefined, zoomLevel: 5, layers: [], schemaName: ''
    });
    this.cities.push({
      name: 'Chacao', location: [10.498820, -66.853737],
      marker: undefined, zoomLevel: 13, layers: [], schemaName: 'chacao'
    });
    this.cities.push({
      name: 'Cumaná', location: [10.433186, -64.174842],
      marker: undefined, zoomLevel: 12, layers: [], schemaName: ''
    });
    this.cities.push({
      name: 'Mérida', location: [8.5875788, -71.157235],
      marker: undefined, zoomLevel: 12, layers: [], schemaName: 'merida'
    });

    // Add Marker of City with GeoInformation
    this.cities.forEach(city => {
      city.marker = marker(city.location, { icon: iconVar }).bindPopup(city.name).openPopup();
    });

    this.gotGeoposition = false;

    this.cities.find(x => x.name === 'Chacao').layers.push({
      layerName: 'Área urbana', queryName: 'a_urbana_geojson', threadType: 'Ninguna',
      gJSON: undefined, color: '#ff3300', downloaded: false
    });
    this.cities.find(x => x.name === 'Chacao').layers.push({
      layerName: 'Aludes Torrenciales', queryName: 'aludes_union_geojson', threadType: 'Aludes torrenciales',
      gJSON: undefined, color: '#0000ff', downloaded: false
    });
    this.cities.find(x => x.name === 'Chacao').layers.push({
      layerName: 'Inundaciones', queryName: 'inundaciones_geojson',
      threadType: 'Inundaciones', gJSON: undefined, color: '#ccff33', downloaded: false
    });
    this.cities.find(x => x.name === 'Chacao').layers.push({
      layerName: 'Hidrografía', queryName: 'hidrografia_line_geojson', threadType: 'Inundaciones y Aludes torrenciales',
      gJSON: undefined, color: '#33cc33', downloaded: false
    });
    this.cities.find(x => x.name === 'Chacao').layers.push({
      layerName: 'Vialidad', queryName: 'vialidad_geojson',
      threadType: 'Ninguna', gJSON: undefined, color: '#750028', downloaded: false
    });
    this.cities.find(x => x.name === 'Chacao').layers.push({
      layerName: 'Manzanas Catastrales', queryName: 'catastro_manzanas_geojson',
      threadType: 'Ninguna', gJSON: undefined, color: '#0000ff', downloaded: false
    });
    this.cities.find(x => x.name === 'Chacao').layers.push({
      layerName: 'Inmuebles Afect Sismo 1967', queryName: 'sismica_afect_t67_geojson',
      threadType: 'Sismica', gJSON: undefined, color: '#59994d', downloaded: false
    });
    this.cities.find(x => x.name === 'Chacao').layers.push({
      layerName: 'Zona Influencia Fallas Geol', queryName: 'buffer_fallag_geojson',
      threadType: 'Sismica', gJSON: undefined, color: '#f9072a', downloaded: false
    });
    this.cities.find(x => x.name === 'Chacao').layers.push({
      layerName: 'Microzonas Sísmicas', queryName: 'mzs_chacao_geojson',
      threadType: 'Sismica', gJSON: undefined, color: '#e32eb5', downloaded: false
    });


    this.cities.find(x => x.name === 'Mérida').layers.push({
      layerName: 'Poligonal urbana', queryName: 'polg_urbana_geojson', threadType: 'Ninguna',
      gJSON: undefined, color: '#ccff33', downloaded: false
    });
    this.cities.find(x => x.name === 'Mérida').layers.push({
      layerName: 'Zona Prot. Río Albarregas', queryName: 'zpr_albarregas_geojson', threadType: 'Ninguna',
      gJSON: undefined, color: '#0000ff', downloaded: false
    });
    this.cities.find(x => x.name === 'Mérida').layers.push({
      layerName: 'Parroquias Libertador', queryName: 'pquias_libertador_geojson', threadType: 'Ninguna',
      gJSON: undefined, color: '#33cc33', downloaded: false
    });
    this.cities.find(x => x.name === 'Mérida').layers.push({
      layerName: 'Bordes de Terraza', queryName: 'bufer_bt_mda_geojson', threadType: 'Sismica - Mov. En masa',
      gJSON: undefined, color: '#ff3300', downloaded: false
    });
    this.cities.find(x => x.name === 'Mérida').layers.push({
      layerName: 'Zona Influencia Fallas Geol', queryName: 'buffer_fallas_geol_geojson',
      threadType: 'Sismica', gJSON: undefined, color: '#ccff33', downloaded: false
    });
    this.cities.find(x => x.name === 'Mérida').layers.push({
      layerName: 'Microzonas Sísmicas', queryName: 'mzs_sedimentos_geojson',
      threadType: 'Sismica', gJSON: undefined, color: '#33cc33', downloaded: false
    });
    this.cities.find(x => x.name === 'Mérida').layers.push({
      layerName: 'Zonas Suceptibles', queryName: 's_mov_mass_geojson',
      threadType: 'Movimientos en masa', gJSON: undefined, color: '#750028', downloaded: false
    });
    this.cities.find(x => x.name === 'Mérida').layers.push({
      layerName: 'Crecida de Afluentes', queryName: 'zp_hydrograf_geojson',
      threadType: 'Crecidas de afluentes hídricos', gJSON: undefined, color: '#0000ff', downloaded: false
    });

    this.searchProvider = new OpenStreetMapProvider();
    this.searchPlaces = [];
    this.isSearchMarkerSet = false;

    this.getAllMaps();
  }
  setSearchMarker(x: number, y: number) {
    this.searchMarker = marker([x, y], {
      icon: icon({
        iconRetinaUrl: 'assets/icon/marker-icon-2x-2.png',
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
  // getNonThreadMaps() {
  //   this.nonThreadMaps.forEach(ntMap => {
  //     this.getLayer(ntMap.queryName).subscribe(
  //       result => {
  //         ntMap.gJSON = geoJSON(result, {
  //           style: {
  //             color: ntMap.color,
  //             weight: 2,
  //             opacity: 0.65
  //           }
  //         });
  //         ntMap.downloaded = true;
  //       },
  //       error => {
  //         console.log(error);
  //       }
  //     );
  //   });
  // }
  // getSeismMaps() {
  //   this.seismThreadMaps.forEach(sMap => {
  //     this.getLayer(sMap.queryName).subscribe(
  //       result => {
  //         sMap.gJSON = geoJSON(result, {
  //           style: {
  //             color: sMap.color,
  //             weight: 2,
  //             opacity: 0.65
  //           }
  //         });
  //         sMap.downloaded = true;
  //       },
  //       error => {
  //         console.log(error);
  //       }
  //     );
  //   });
  // }
  // getLandSlideMaps() {
  //   this.landSlideThreadMaps.forEach(landMap => {
  //     this.getLayer(landMap.queryName).subscribe(
  //       result => {
  //         landMap.gJSON = geoJSON(result, {
  //           style: {
  //             color: landMap.color,
  //             weight: 2,
  //             opacity: 0.65
  //           }
  //         });
  //         landMap.downloaded = true;
  //       },
  //       error => {
  //         console.log(error);
  //       }
  //     );
  //   });
  // }
  // getFloodThreadMaps() {
  //   this.floodThreadMaps.forEach(floodMap => {
  //     this.getLayer(floodMap.queryName).subscribe(
  //       result => {
  //         floodMap.gJSON = geoJSON(result, {
  //           style: {
  //             color: floodMap.color,
  //             weight: 2,
  //             opacity: 0.65
  //           }
  //         });
  //         floodMap.downloaded = true;
  //       },
  //       error => {
  //         console.log(error);
  //       }
  //     );
  //   });
  // }
  getAllMaps() {
    this.cities.forEach(city => {
      if (city.layers.length > 0) {
        city.layers.forEach(layer => {
          this.getLayer(city.schemaName, layer.queryName).subscribe(
            result => {
              layer.gJSON = geoJSON(result, {
                style: {
                  color: layer.color,
                  weight: 2,
                  opacity: 0.45
                }
              });
              layer.downloaded = true;
            },
            error => {
              console.log(error);
            }
          );
        });
      }
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
