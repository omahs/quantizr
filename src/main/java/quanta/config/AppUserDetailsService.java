package quanta.config;

import static quanta.util.Util.ok;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import quanta.model.client.NodeProp;
import quanta.model.client.PrincipalName;
import quanta.mongo.model.SubNode;

/**
 * Part of Spring Security implementation
 */
@Service
public class AppUserDetailsService extends ServiceBase implements UserDetailsService {
    private static final Logger log = LoggerFactory.getLogger(AppUserDetailsService.class);

    @Override
    public UserDetails loadUserByUsername(String userName) throws UsernameNotFoundException {
        if (PrincipalName.ADMIN.s().equals(userName)) {
            return new AppUserDetails(userName, prop.getAdminPassword());
        } else {
            SubNode userNode = arun.run(as -> read.getUserNodeByUserName(as, userName));
            if (ok(userNode)) {
                String pwdHash = userNode.getStr(NodeProp.PWD_HASH);
                return new AppUserDetails(userName, pwdHash);
            } else {
                throw new UsernameNotFoundException("Not found: " + userName);
            }
        }
    }
}
