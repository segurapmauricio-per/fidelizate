import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";



const { auth } = NextAuth(authConfig);



function homeForRole(role: string | undefined): string {

  if (role === "SUPER_ADMIN") return "/admin";

  if (role === "MANAGER") return "/dashboard";

  return "/caja";

}



const PUBLIC_PATHS = [

  "/login",

  "/forgot-password",

  "/reset-password",

  "/activar",

];



function isPublicPath(pathname: string): boolean {

  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

}



export default auth((req) => {

  const { pathname } = req.nextUrl;

  const session = req.auth;

  const isLoggedIn = Boolean(

    session?.user?.userId && session.user.role && session.user.businessId

  );



  const role = session?.user?.role;

  const home = homeForRole(role);

  const mustChange = Boolean(session?.user?.mustChangePassword);



  const isPublicAuthPage = isPublicPath(pathname);

  const isChangePasswordPage = pathname.startsWith("/cambiar-contrasena");



  if (isPublicAuthPage && isLoggedIn) {

    if (mustChange) {

      return Response.redirect(new URL("/cambiar-contrasena", req.nextUrl));

    }

    return Response.redirect(new URL(home, req.nextUrl));

  }



  if (!isPublicAuthPage && !isChangePasswordPage && !isLoggedIn) {

    return Response.redirect(new URL("/login", req.nextUrl));

  }



  if (isLoggedIn && mustChange && !isChangePasswordPage) {

    return Response.redirect(new URL("/cambiar-contrasena", req.nextUrl));

  }



  if (pathname.startsWith("/admin") && role !== "SUPER_ADMIN") {

    return Response.redirect(new URL(home, req.nextUrl));

  }



  if (pathname.startsWith("/dashboard") && role !== "MANAGER") {

    return Response.redirect(new URL(home, req.nextUrl));

  }

});



export const config = {

  matcher: [

    "/admin/:path*",

    "/dashboard/:path*",

    "/caja/:path*",

    "/login",

    "/cambiar-contrasena",

    "/forgot-password",

    "/reset-password",

    "/activar",

  ],

};

