package quanta.request;

import quanta.request.base.RequestBase;

public class AddFriendRequest extends RequestBase {
	private String userName;
	
	public String getUserName() {
		return userName;
	}

	public void setUserName(String userName) {
		this.userName = userName;
	}
}
