package org.subnode.util;

// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.context.annotation.Bean;
// import org.springframework.context.annotation.Configuration;
// import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
// import org.springframework.security.config.annotation.web.builders.HttpSecurity;
// import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
// import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
// import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
// import org.springframework.security.crypto.password.PasswordEncoder;
// import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
// import org.subnode.config.AppFilter;

//#spring-sec <---- I'm using this tag to identify the key plaes in the code where spring security
// is being implemented
// @Configuration
// @EnableWebSecurity(debug = true)
public class CustomWebSecurityConfigurerAdapter {
    // extends WebSecurityConfigurerAdapter {

    // @Autowired private RestAuthenticationEntryPoint authenticationEntryPoint;

    // @Autowired
    // public void configureGlobal(AuthenticationManagerBuilder auth) throws Exception {
    //     auth
    //       .inMemoryAuthentication()
    //       .withUser("user1")
    //       .password(passwordEncoder().encode("user1Pass"))
    //       .authorities("ROLE_USER");
    // }

    // @Override
    // protected void configure(HttpSecurity http) throws Exception {

    //     http
    //       .authorizeRequests()
    //       .antMatchers("/**", "/*", "/**/*")
    //       .permitAll()
    //       .anyRequest()
    //       .authenticated()
    //       .and()
    //       .httpBasic()
    //       .authenticationEntryPoint(authenticationEntryPoint)
    //       .exceptionHandling().authenticationEntryPoint(authenticationEntryPoint)

    //     http.addFilterAfter(new AppFilter() /* CustomFilter() */, BasicAuthenticationFilter.class);
    // }
 
    // @Bean
    // public PasswordEncoder passwordEncoder() {
    //     return new BCryptPasswordEncoder();
    // }
}