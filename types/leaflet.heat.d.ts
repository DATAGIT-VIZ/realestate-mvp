import * as L from 'leaflet'

declare module 'leaflet' {
  interface HeatLatLngTuple extends Array<number> {
    0: number // lat
    1: number // lng
    2?: number // intensity
  }

  interface HeatLayerOptions {
    minOpacity?: number
    maxZoom?: number
    max?: number
    radius?: number
    blur?: number
    gradient?: Record<string, string>
  }

  class HeatLayer extends Layer {
    constructor(latlngs: HeatLatLngTuple[], options?: HeatLayerOptions)
    setLatLngs(latlngs: HeatLatLngTuple[]): this
    addLatLng(latlng: HeatLatLngTuple): this
    setOptions(options: HeatLayerOptions): this
    redraw(): this
  }

  function heatLayer(latlngs: HeatLatLngTuple[], options?: HeatLayerOptions): HeatLayer
}
