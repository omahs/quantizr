package quanta.response;

import java.util.List;
import quanta.model.client.MFSDirEntry;
import quanta.response.base.ResponseBase;

public class GetIPFSFilesResponse extends ResponseBase {

	public List<MFSDirEntry> files;

	// returns whatever folder ended up gettin gloaded
	public String folder;
	public String cid;

	public String getFolder() {
		return folder;
	}

	public void setFolder(String folder) {
		this.folder = folder;
	}

	public List<MFSDirEntry> getFiles() {
		return files;
	}

	public void setFiles(List<MFSDirEntry> files) {
		this.files = files;
	}

	public String getCid() {
		return cid;
	}

	public void setCid(String cid) {
		this.cid = cid;
	}
}
