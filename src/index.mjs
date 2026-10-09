// Deployable entry point for the eve-assist.561.group Worker. All behavior
// lives in the engine package (@red-cup-engineering/eve-online-services-section)
// per the section 4 "engineering builds capability, sites deploy it"
// convention — this file must stay a thin re-export, never grow logic of its
// own, so the engine package remains the single source of truth other agents
// can depend on.
import { createEveAssistWorker } from "@red-cup-engineering/eve-online-services-section/web";

export default createEveAssistWorker();
