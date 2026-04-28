"use client";

import { Map, Marker } from "pigeon-maps";
import { MapPin } from 'lucide-react';

const unidades = [
  { nome: "Malibu Exclusive Hortolândia", lat: -22.90, lng: -47.18 },
  { nome: "Malibu Academia Sorocaba", lat: -23.50, lng: -47.45 },
  { nome: "Malibu Mogi Mirim", lat: -22.43, lng: -46.95 },
  { nome: "Malibu Exclusive Americana", lat: -22.74, lng: -47.33 },
  { nome: "Malibu Exclusive Mogi Guaçu", lat: -22.37, lng: -46.94 },
  { nome: "Malibu Exclusive Araras", lat: -22.35, lng: -47.38 },
  { nome: "Malibu Exclusive Araçatuba", lat: -21.20, lng: -50.43 },
];

export default function MalibuMap() {
  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden border border-border/50 shadow-lg">
      <Map 
        height={500} 
        defaultCenter={[-22.90, -47.18]} 
        defaultZoom={7}
        metaWheelZoom={true}
        dprs={[1, 2]}
        boxClassname="rounded-xl"
      >
        {unidades.map((u, index) => (
          <Marker 
            key={index} 
            anchor={[u.lat, u.lng]} 
            onClick={() => alert(u.nome)}
            color="#F28C1D"
          >
            <div className="relative -top-4 -left-4 flex items-center justify-center w-8 h-8 bg-malibu-orange rounded-full shadow-md border-2 border-white">
              <MapPin className="h-4 w-4 text-white" />
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}