'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Coordinates for major Indian cities — extended list for full-India coverage
const CITY_COORDS: Record<string, [number, number]> = {
  // Metro / Tier-1
  'Mumbai':          [19.0760,  72.8777],
  'Delhi':           [28.6139,  77.2090],
  'Bengaluru':       [12.9716,  77.5946],
  'Bangalore':       [12.9716,  77.5946],
  'Hyderabad':       [17.3850,  78.4867],
  'Ahmedabad':       [23.0225,  72.5714],
  'Chennai':         [13.0827,  80.2707],
  'Kolkata':         [22.5726,  88.3639],
  'Pune':            [18.5204,  73.8567],
  // NCR
  'Gurugram':        [28.4595,  77.0266],
  'Gurgaon':         [28.4595,  77.0266],
  'Noida':           [28.5355,  77.3910],
  'Noida Extension': [28.6374,  77.4329],
  'Greater Noida':   [28.4744,  77.5040],
  'Faridabad':       [28.4089,  77.3178],
  'Greater Faridabad':[28.3740, 77.3149],
  'Ghaziabad':       [28.6692,  77.4538],
  'Dwarka Expressway':[28.6110, 76.9877],
  // Tier-2
  'Jaipur':          [26.9124,  75.7873],
  'Lucknow':         [26.8467,  80.9462],
  'Chandigarh':      [30.7333,  76.7794],
  'Indore':          [22.7196,  75.8577],
  'Bhopal':          [23.2599,  77.4126],
  'Kochi':           [ 9.9312,  76.2673],
  'Coimbatore':      [11.0168,  76.9558],
  'Surat':           [21.1702,  72.8311],
  'Vadodara':        [22.3072,  73.1812],
  'Nagpur':          [21.1458,  79.0882],
  'Visakhapatnam':   [17.6868,  83.2185],
  'Mysore':          [12.2958,  76.6394],
  'Mysuru':          [12.2958,  76.6394],
  'Thiruvananthapuram':[8.5241, 76.9366],
  'Bhubaneswar':     [20.2961,  85.8245],
  'Patna':           [25.5941,  85.1376],
  'Dehradun':        [30.3165,  78.0322],
  'Goa':             [15.2993,  74.1240],
  'Panaji':          [15.4909,  73.8278],
  'Vasco':           [15.3960,  73.8145],
  'Navi Mumbai':     [19.0330,  73.0297],
  'Thane':           [19.2183,  72.9781],
  'Kalyan':          [19.2437,  73.1355],
  'Nashik':          [19.9975,  73.7898],
  'Kolhapur':        [16.7050,  74.2433],
  'Aurangabad':      [19.8762,  75.3433],
  'Amravati':        [20.9374,  77.7796],
  'Rajkot':          [22.3039,  70.8022],
  'Jodhpur':         [26.2389,  73.0243],
  'Udaipur':         [24.5854,  73.7125],
  'Kota':            [25.2138,  75.8648],
  'Agra':            [27.1767,  78.0081],
  'Varanasi':        [25.3176,  82.9739],
  'Kanpur':          [26.4499,  80.3319],
  'Allahabad':       [25.4358,  81.8463],
  'Prayagraj':       [25.4358,  81.8463],
  'Meerut':          [28.9845,  77.7064],
  'Ranchi':          [23.3441,  85.3096],
  'Raipur':          [21.2514,  81.6296],
  'Amritsar':        [31.6340,  74.8723],
  'Ludhiana':        [30.9010,  75.8573],
  'Jalandhar':       [31.3260,  75.5762],
  'Shimla':          [31.1048,  77.1734],
  'Jammu':           [32.7266,  74.8570],
}

export type HeatPoint = { city: string; count: number }

type Props = { points?: HeatPoint[] }

// India center & zoom for full-country view
const INDIA_CENTER: [number, number] = [22.5, 80.0]
const INDIA_ZOOM = 5

function HeatLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap()

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('leaflet.heat') // patches L at runtime, must happen after leaflet loads
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet') as typeof import('leaflet')

    const data: L.HeatLatLngTuple[] = []

    points.forEach(({ city, count }) => {
      const coord = CITY_COORDS[city]
      if (coord) data.push([coord[0], coord[1], Math.min(count / 10, 1)])
    })

    // Fallback demo spread across India when no real city data yet
    if (data.length === 0) {
      const demos: [string, number][] = [
        ['Mumbai', 8], ['Delhi', 9], ['Bengaluru', 7], ['Hyderabad', 6],
        ['Pune', 5], ['Chennai', 5], ['Ahmedabad', 4], ['Gurugram', 6],
        ['Noida', 5], ['Kolkata', 4], ['Jaipur', 3], ['Kochi', 3],
      ]
      demos.forEach(([city, w]) => {
        const c = CITY_COORDS[city]
        if (c) data.push([c[0], c[1], w / 10])
      })
    }

    const heat = L.heatLayer(data, {
      radius: 30,
      blur: 25,
      maxZoom: 10,
      max: 1,
      gradient: { 0.2: '#93AEFF', 0.5: '#528BFF', 0.8: '#1D4ED8', 1.0: '#0F2D8A' },
    }).addTo(map)

    return () => { map.removeLayer(heat) }
  }, [map, points])

  return null
}

export default function NcrMap({ points = [] }: Props) {

  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={INDIA_ZOOM}
      style={{ width: '100%', height: '100%', borderRadius: 8 }}
      zoomControl={true}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      <HeatLayer points={points} />
    </MapContainer>
  )
}
