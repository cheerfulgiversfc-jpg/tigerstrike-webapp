(function(root){
  const title='Blackout at River Gate';
  const types=['expedition-solo','expedition-squad'];
  const routes={
    clinic:{name:'Restore the clinic',choice:'Power up the clinic so it can treat the injured before their escort.',result:'The clinic reopened. All three patients could be stabilized before the escort.'},
    bridge:{name:'Reopen the bridge',choice:'Open a shorter crossing. Expect an extra tiger patrol at the bridge.',result:'The bridge reopened. The squad used a shorter crossing and cleared its extra patrol.'},
  };
  const stages=['Restore the route','Bring everyone out','Get them home'];
  const checkpointIds=['exp_clinic_power','exp_bridge_open','exp_triage','exp_crossing'];
  const holdMs=8000;
  const isExpedition=type=>types.includes(type);
  const isSolo=type=>type===types[0];
  const api={title,types,routes,stages,checkpointIds,holdMs,isExpedition,isSolo};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TigerRescueExpedition=api;
})(globalThis);
