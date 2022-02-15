package quanta.actpub.model;

import quanta.actpub.APConst;

/**
 * Accept object
 */
public class APOAccept extends APObj {
    public APOAccept() {
        put(context, APConst.CONTEXT_STREAMS);
        put(type, APType.Accept);
    }

    // todo-0: Mastodon definitely works WITHOUT the 'toActor', but we may need it for
    // compatibility with Pleroma
    public APOAccept(String actor, String toActor, String id, APObj object) {
        this();
        put(APObj.cc, new APList()); // todo-0: also hoping empty cc array is compatible with Masto and maybe required for Pleroma?
        put(APObj.actor, actor);
        put(APObj.to, new APList().val(toActor));
        put(APObj.id, id);
        put(APObj.object, object); 
    }

    @Override
    public APOAccept put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
