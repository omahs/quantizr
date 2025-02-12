package quanta.model.ipfs.dag;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

public class MerkleNode {

    @JsonProperty("Hash")
    private String hash;

    @JsonProperty("Links")
    private List<MerkleLink> links;

    @JsonIgnore
    private String contentType;

    public List<MerkleLink> getLinks() {
        return links;
    }

    public void setLinks(List<MerkleLink> links) {
        this.links = links;
    }


    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public String getContentType() {
        return this.contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }
}