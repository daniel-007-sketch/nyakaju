"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "./AdminDashboard.module.css";

type Booking = {
  id:number; confirmation_code:string; guest_first_name:string; guest_last_name:string;
  guest_email:string; guest_phone:string; arrival_date:string; departure_date:string;
  status:string; nightly_rate:number; total_amount:number; currency:string;
  admin_notes:string|null; created_at:string; updated_at:string; status_updated_at:string;
  room_types:{name:string;slug:string}|null;
};
type RoomImage={id:number;storage_path:string;alt_text:string;is_primary:boolean};
type Room={id:number;name:string;slug:string;description:string;nightly_rate:number;currency:string;total_units:number;beds:number;bathrooms:number;is_active:boolean;room_images:RoomImage[]};
type Overview={totalUnits:number;occupiedUnits:number;availableUnits:number;occupancyPercent:number;monthlyEarnings:number;todayEarnings:number;currency:string;totalBookings:number;statusCounts:Record<string,number>};

async function getJson<T>(url:string, init?:RequestInit):Promise<T>{
  const response=await fetch(url,init);
  const body=await response.json().catch(()=>({}));
  if(response.status===401){location.replace("/admin-login");throw new Error("Session expired");}
  if(!response.ok) throw new Error(body.error||"Request failed");
  return body;
}
const statuses=["pending","confirmed","rejected","cancelled","completed"];

export function AdminDashboard(){
  const [view,setView]=useState<"overview"|"bookings"|"rooms">("overview");
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [rooms,setRooms]=useState<Room[]>([]);
  const [overview,setOverview]=useState<Overview|null>(null);
  const [selected,setSelected]=useState<Booking|null>(null);
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("");
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const [b,r,o]=await Promise.all([
        getJson<{bookings:Booking[]}>(`/api/admin/bookings${status?`?status=${status}`:""}`),
        getJson<{rooms:Room[]}>("/api/admin/rooms"),
        getJson<Overview>(`/api/admin/overview?month=${month}`)
      ]);
      setBookings(b.bookings);setRooms(r.rooms);setOverview(o);
    }catch(e){setError((e as Error).message)}finally{setLoading(false)}
  },[month,status]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>void load(),0);
    return ()=>window.clearTimeout(timer);
  },[load]);

  const filtered=useMemo(()=>{
    const q=search.toLowerCase().trim();
    if(!q)return bookings;
    return bookings.filter(b=>[b.confirmation_code,b.guest_first_name,b.guest_last_name,b.guest_email,b.guest_phone,b.room_types?.name].join(" ").toLowerCase().includes(q));
  },[bookings,search]);
  const money=(value:number,currency="USD")=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(value);
  const imageUrl=(path:string)=>createClient().storage.from("room-images").getPublicUrl(path).data.publicUrl;

  async function updateBooking(booking:Booking, nextStatus=booking.status, notes=booking.admin_notes){
    try{
      const result=await getJson<{booking:Booking}>(`/api/admin/bookings/${booking.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:nextStatus,adminNotes:notes??""})});
      setBookings(items=>items.map(item=>item.id===booking.id?result.booking:item));
      setSelected(result.booking);
      await load();
    }catch(e){setError((e as Error).message)}
  }
  async function logout(){await fetch("/api/auth/logout",{method:"POST"});location.replace("/admin-login")}
  const monthOptions=Array.from({length:13},(_,i)=>{const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+i-6);return d.toISOString().slice(0,7)});

  return <div className={styles.shell}>
    <aside className={styles.sidebar}><div className={styles.brand}>NYAKAJU</div><div className={styles.eyebrow}>Hotel administration</div>
      <nav className={styles.nav}>{(["overview","bookings","rooms"] as const).map(item=><button key={item} className={view===item?styles.active:""} onClick={()=>setView(item)}>{item[0].toUpperCase()+item.slice(1)}{item==="bookings"&&overview?` · ${overview.totalBookings}`:""}</button>)}</nav>
      <button className={styles.logout} onClick={logout}>Log out</button>
    </aside>
    <div className={styles.mobileBar}><span className={styles.brand}>NYAKAJU</span><button className={styles.logout} onClick={logout}>Log out</button></div>
    <main className={styles.main}>
      <header className={styles.topbar}><div><div className={styles.eyebrow}>Live hotel operations</div><h1 className={styles.title}>{view[0].toUpperCase()+view.slice(1)}</h1></div>
        <div className={styles.actions}><select className={styles.select} value={month} onChange={e=>setMonth(e.target.value)} aria-label="Reporting month">{monthOptions.map(m=><option value={m} key={m}>{new Date(`${m}-02`).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</option>)}</select><button className={styles.refresh} onClick={()=>void load()}>{loading?"Loading…":"Refresh data"}</button></div>
      </header>
      {error&&<div className={styles.error} role="alert">{error}</div>}
      <section className={styles.stats}>
        <div className={styles.stat}><div className={styles.eyebrow}>All bookings</div><div className={styles.statValue}>{overview?.totalBookings??"—"}</div><div className={styles.statMeta}>{overview?.statusCounts.pending??0} awaiting review</div></div>
        <div className={styles.stat}><div className={styles.eyebrow}>Occupied today</div><div className={styles.statValue}>{overview?.occupiedUnits??"—"} / {overview?.totalUnits??"—"}</div><div className={styles.statMeta}>{overview?.occupancyPercent??0}% occupancy</div></div>
        <div className={styles.stat}><div className={styles.eyebrow}>Available today</div><div className={styles.statValue}>{overview?.availableUnits??"—"}</div><div className={styles.statMeta}>Across active room types</div></div>
        <div className={styles.stat}><div className={styles.eyebrow}>Monthly earnings</div><div className={styles.statValue}>{money(overview?.monthlyEarnings??0,overview?.currency)}</div><div className={styles.statMeta}>Bookings confirmed this month</div></div>
        <div className={styles.stat}><div className={styles.eyebrow}>Today&apos;s earnings</div><div className={styles.statValue}>{money(overview?.todayEarnings??0,overview?.currency)}</div><div className={styles.statMeta}>Bookings confirmed today</div></div>
      </section>
      {(view==="overview"||view==="bookings")&&<section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>{view==="overview"?"Recent bookings":"All booking records"}</h2><div className={styles.muted}>{filtered.length} record{filtered.length===1?"":"s"} shown</div></div>
          <div className={styles.toolbar}><input className={styles.search} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search guest, phone or code" aria-label="Search bookings"/><select className={styles.select} value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></div>
        </div>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Guest & contact</th><th>Room</th><th>Stay</th><th>Value</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>
          {(view==="overview"?filtered.slice(0,8):filtered).map(b=><tr key={b.id}><td><div className={styles.primary}>{b.guest_first_name} {b.guest_last_name}</div><div className={styles.muted}>{b.guest_email}<br/>{b.guest_phone}</div></td><td><div className={styles.primary}>{b.room_types?.name??"Unknown room"}</div><div className={styles.muted}>{b.confirmation_code}</div></td><td>{b.arrival_date}<br/><span className={styles.muted}>to {b.departure_date}</span></td><td className={styles.amount}>{money(Number(b.total_amount),b.currency)}<div className={styles.muted}>{money(Number(b.nightly_rate),b.currency)}/night</div></td><td><select className={styles.status} value={b.status} onChange={e=>void updateBooking(b,e.target.value)} aria-label={`Status for ${b.confirmation_code}`}>{statuses.map(s=><option key={s}>{s}</option>)}</select></td><td>{new Date(b.created_at).toLocaleDateString()}<div className={styles.muted}>{new Date(b.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div></td><td><button className={styles.details} onClick={()=>setSelected(b)}>View all</button></td></tr>)}
        </tbody></table>{!loading&&!filtered.length&&<div className={styles.empty}>No matching bookings found.</div>}</div>
      </section>}
      {view==="rooms"&&<section className={styles.rooms}>{rooms.map(room=>{const image=room.room_images.find(i=>i.is_primary)??room.room_images[0];return <article className={styles.room} key={room.id}>{image?<Image unoptimized width={480} height={320} className={styles.roomImg} src={imageUrl(image.storage_path)} alt={image.alt_text||room.name}/>:<div className={styles.roomImg}/>}<div className={styles.roomBody}><div className={styles.eyebrow}>{room.is_active?"Active":"Inactive"} · {room.slug}</div><h2 className={styles.roomTitle}>{room.name}</h2><div className={styles.muted}>{room.description}</div><div className={styles.roomFacts}><div className={styles.roomFact}><strong>{room.total_units}</strong>units</div><div className={styles.roomFact}><strong>{room.beds}</strong>beds</div><div className={styles.roomFact}><strong>{money(Number(room.nightly_rate),room.currency)}</strong>night</div></div></div></article>})}</section>}
    </main>
    {selected&&<div className={styles.drawerBackdrop} onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><section className={styles.drawer} aria-modal="true" role="dialog"><div className={styles.drawerTop}><div><div className={styles.eyebrow}>Complete database record</div><h2 className={styles.panelTitle}>{selected.guest_first_name} {selected.guest_last_name}</h2></div><button className={styles.close} onClick={()=>setSelected(null)} aria-label="Close">×</button></div>
      <div className={styles.detailGrid}>{[["Confirmation",selected.confirmation_code],["Room",selected.room_types?.name],["Email",selected.guest_email],["Phone",selected.guest_phone],["Arrival",selected.arrival_date],["Departure",selected.departure_date],["Nightly rate",money(Number(selected.nightly_rate),selected.currency)],["Total",money(Number(selected.total_amount),selected.currency)],["Created",new Date(selected.created_at).toLocaleString()],["Last updated",new Date(selected.updated_at).toLocaleString()],["Status updated",new Date(selected.status_updated_at).toLocaleString()],["Database ID",selected.id]].map(([label,value])=><div className={styles.detail} key={String(label)}><span>{label}</span>{value??"—"}</div>)}</div>
      <label className={styles.eyebrow} htmlFor="adminNotes">Admin notes</label><textarea id="adminNotes" className={styles.notes} value={selected.admin_notes??""} onChange={e=>setSelected({...selected,admin_notes:e.target.value})}/><button className={styles.save} onClick={()=>void updateBooking(selected)}>Save notes and status</button>
    </section></div>}
  </div>
}
